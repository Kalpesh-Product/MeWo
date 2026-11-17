import { loadEnvConfig } from "@next/env";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BSON, MongoClient } from "mongodb";
import { mongoConfig } from "../lib/server/mongo-config";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const { uri, database, options } = mongoConfig();
  const client = new MongoClient(uri, options);
  const s3 = new S3Client({
    region: "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.PROJECT_AWS_ACCESS_KEY || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.PROJECT_AWS_SECRET_KEY || "",
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
  });
  try {
    await client.connect();
    const db = client.db(database);
    const attachments = await db.collection("startup_submissions").find(
      { presentation: { $exists: true } },
      { projection: { presentation: 1 } },
    ).toArray();
    for (const { presentation } of attachments) {
      if (!presentation?.presentationLink || !presentation.sha256 || !Number.isSafeInteger(presentation.size)) {
        throw new Error("A presentation has no verified S3 link or file metadata.");
      }
      const url = new URL(presentation.presentationLink);
      if (url.hostname !== "wonov-aws-s3-storage.s3.ap-south-1.amazonaws.com") {
        throw new Error("A presentation has an unexpected storage location.");
      }
      const key = decodeURIComponent(url.pathname.slice(1));
      if (!key.startsWith("wono/BizNest/New MeWo Website/Attachments/")) {
        throw new Error("A presentation has an unexpected S3 prefix.");
      }
      const response = await s3.send(new GetObjectCommand({ Bucket: "wonov-aws-s3-storage", Key: key }), {
        abortSignal: AbortSignal.timeout(30000),
      });
      if (!response.Body) throw new Error("An S3 presentation has no body.");
      const bytes = await response.Body.transformToByteArray();
      if (bytes.length !== presentation.size || createHash("sha256").update(bytes).digest("hex") !== presentation.sha256) {
        throw new Error("An S3 presentation does not match its saved size and checksum.");
      }
    }
    const files = await db.collection("presentations.files").find().toArray();
    const chunks = await db.collection("presentations.chunks").find().toArray();
    if (!files.length && !chunks.length) {
      console.log("No legacy GridFS data remains.");
      return;
    }
    const directory = path.join(process.cwd(), ".reference", "mongodb-backups");
    await mkdir(directory, { recursive: true });
    const backup = path.join(directory, `legacy-gridfs-${randomUUID()}.json`);
    const data = { database, files, chunks };
    await writeFile(backup, BSON.EJSON.stringify(data), { flag: "wx", mode: 0o600 });
    const restored = BSON.EJSON.parse(await readFile(backup, "utf8")) as typeof data;
    if (restored.files.length !== files.length || restored.chunks.length !== chunks.length) {
      throw new Error("GridFS backup verification failed.");
    }
    await db.collection("presentations.chunks").drop();
    await db.collection("presentations.files").drop();
    console.log(`Verified ${attachments.length} S3 presentations, backed up ${files.length} legacy files and ${chunks.length} chunks, and removed both GridFS collections.`);
  } finally {
    s3.destroy();
    await client.close();
  }
}
main().catch((error) => {
  console.error("Legacy GridFS cleanup failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
