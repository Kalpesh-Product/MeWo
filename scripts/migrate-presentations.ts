import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";
import { GridFSBucket, MongoClient } from "mongodb";
import { mongoConfig } from "../lib/server/mongo-config";
import { collections, initializeDatabase, presentationBucket } from "../lib/server/mongo-schema";
import { ensureAttachmentPrefix, uploadAttachment } from "../lib/server/s3-attachments.mjs";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const { uri, database, options } = mongoConfig();
  const client = new MongoClient(uri, options);
  try {
    const db = client.db(database);
    const submissions = db.collection(collections.submissions);
    const filter = {
      source: "startup",
      "fields.presentation.fileId": { $type: "objectId" },
      "fields.presentation.presentationLink": { $exists: false },
    };
    if (!process.argv.includes("--apply")) {
      console.log(await submissions.countDocuments(filter), "presentations eligible for S3 migration. Add --apply to migrate.");
      return;
    }
    await ensureAttachmentPrefix();
    await initializeDatabase(db);
    const bucket = new GridFSBucket(db, { bucketName: presentationBucket });
    let migrated = 0;
    for await (const record of submissions.find(filter, { projection: { "fields.presentation": 1 } })) {
      const { fileId, filename, mimeType, size, sha256 } = record.fields.presentation;
      if (!Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024) throw new Error("Invalid stored file size.");
      const chunks: Buffer[] = [];
      const stream = bucket.openDownloadStream(fileId);
      let length = 0;
      for await (const chunk of stream) {
        length += chunk.length;
        if (length > size) throw new Error("Stored file exceeds recorded size.");
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks, length);
      if (length !== size || createHash("sha256").update(bytes).digest("hex") !== sha256) {
        throw new Error("Stored presentation checksum or size mismatch.");
      }
      const link = await uploadAttachment(record._id.toHexString(), filename, mimeType, bytes);
      const result = await submissions.updateOne({ _id: record._id, ...filter, "fields.presentation.fileId": fileId }, {
        $set: { "fields.presentation.presentationLink": link },
      });
      migrated += result.modifiedCount;
    }
    console.log("Migrated", migrated, "presentations to S3. GridFS originals retained.");
  } finally {
    await client.close();
  }
}

main().catch(() => {
  console.error("Presentation migration failed. Check MongoDB, legacy file integrity, and S3 credentials.");
  process.exitCode = 1;
});
