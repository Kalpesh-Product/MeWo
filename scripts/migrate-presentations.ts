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
    const submissions = db.collection(collections.startup);
    const filter = {
      source: "startup",
      "presentation.fileId": { $type: "objectId" },
      "presentation.presentationLink": { $exists: false },
    };
    if (!process.argv.includes("--apply")) {
      console.log(await submissions.countDocuments(filter), "presentations eligible for S3 migration. Add --apply to migrate.");
      return;
    }
    await ensureAttachmentPrefix();
    await initializeDatabase(db);
    const bucket = new GridFSBucket(db, { bucketName: presentationBucket });
    let migrated = 0;
    for await (const record of submissions.find(filter, { projection: { "presentation": 1 } })) {
      console.log("Reading one legacy GridFS presentation.");
      const { fileId, filename, mimeType, size, sha256 } = record.presentation;
      if (!Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024) throw new Error("Invalid stored file size.");
      const chunks: Buffer[] = [];
      const stream = bucket.openDownloadStream(fileId);
      let length = 0;
      for await (const chunk of stream) {
        length += chunk.length;
        if (length > size) throw new Error("Stored file exceeds recorded size.");
        chunks.push(chunk);
      }
      console.log("Legacy GridFS read completed.");
      const bytes = Buffer.concat(chunks, length);
      if (length !== size || createHash("sha256").update(bytes).digest("hex") !== sha256) {
        throw new Error("Stored presentation checksum or size mismatch.");
      }
      console.log("Uploading verified presentation to S3.");
      const link = await uploadAttachment(record._id.toHexString(), filename, mimeType, bytes);
      console.log("S3 upload completed; saving link.");
      const result = await submissions.updateOne({ _id: record._id, ...filter, "presentation.fileId": fileId }, {
        $set: { "presentation.presentationLink": link },
      });
      migrated += result.modifiedCount;
    }
    console.log("Migrated", migrated, "presentations to S3. GridFS originals retained.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Presentation migration failed. Check MongoDB, legacy file integrity, and S3 credentials.", error instanceof Error ? error.name : "unknown error");
  process.exitCode = 1;
});
