import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { test } from "node:test";
import { GridFSBucket, MongoClient } from "mongodb";
import { initializeDatabase, collections, presentationBucket } from "../lib/server/mongo-schema";
import { checkSubmissionRate, saveInquiry } from "../lib/server/inquiry-storage";
import { InquiryError, parseInquiry, parsePresentation } from "../lib/server/inquiry-validation";
import { migrateSubmissions } from "../lib/server/migrate-submissions";
import { mongoConfig } from "../lib/server/mongo-config";

test("MongoDB persistence and indexes (isolated temporary database)", async (t) => {
  loadEnvConfig(process.cwd(), true);
  const databaseName = `mewo_test_${randomUUID().replaceAll("-", "")}`;
  const config = mongoConfig();
  const client = new MongoClient(config.uri, config.options);
  await client.connect();
  const db = client.db(databaseName);
  try {
    await initializeDatabase(db);
    await initializeDatabase(db);
    const data = new FormData();
    for (const [key, value] of Object.entries({ kind: "contact", name: "Backend Test", email: "backend@example.com", phone: "+91 80071 26444", message: "Verification only" })) data.set(key, value);
    const contact = parseInquiry(data);
    await t.test("contact saves normalized fields and workflow timestamps", async () => {
      await saveInquiry(db, contact);
      const record = await db.collection(collections.submissions).findOne({ source: "contact", "fields.email": contact.email });
      assert.equal(record?.status, "new");
      assert.equal(record?.source, "contact");
      assert.equal(record?.fields.name, "Backend Test");
      assert.equal(record?.email, undefined);
      assert.ok(record?.createdAt instanceof Date);
      assert.ok(record?.updatedAt instanceof Date);
    });
    await t.test("newsletter signup is idempotent under concurrency", async () => {
      await Promise.all(Array.from({ length: 12 }, () => saveInquiry(db, { kind: "subscription", email: "subscriber@example.com" })));
      assert.equal(await db.collection(collections.submissions).countDocuments({ source: "subscription" }), 1);
    });
    await t.test("startup presentation is stored privately in GridFS and round-trips", async () => {
      data.set("kind", "startup"); data.set("startup_name", "Test Startup");
      const bytes = Buffer.from("%PDF-1.7\nTest presentation\n%%EOF");
      data.set("presentation", new File([bytes], "deck.pdf", { type: "application/pdf" }));
      const startup = parseInquiry(data);
      await saveInquiry(db, startup, await parsePresentation(data, startup.kind));
      const record = await db.collection(collections.submissions).findOne({ source: "startup", "fields.email": startup.email });
      assert.equal(record?.fields.startupName, "Test Startup");
      assert.equal(record?.fields.presentation.size, bytes.length);
      const bucket = new GridFSBucket(db, { bucketName: presentationBucket });
      const chunks: Buffer[] = [];
      for await (const chunk of bucket.openDownloadStream(record!.fields.presentation.fileId)) chunks.push(chunk);
      assert.deepEqual(Buffer.concat(chunks), bytes);
      assert.equal((await bucket.find({ _id: record!.fields.presentation.fileId }).next())?.metadata?.submissionId.toString(), record!._id.toString());
    });
    await t.test("database validator rejects malformed direct writes", async () => {
      const invalid = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 121;
      await assert.rejects(() => db.collection(collections.submissions).insertOne({ email: "invalid" }), invalid);
      await assert.rejects(() => db.collection(collections.submissions).insertOne({ source: "contact", fields: { email: "bad" }, status: "new", createdAt: new Date(), updatedAt: new Date() }), invalid);
      await assert.rejects(() => db.collection(collections.submissions).insertOne({ source: "unknown", fields: { email: "test@example.com" }, status: "new", createdAt: new Date(), updatedAt: new Date() }), invalid);
    });
    await t.test("legacy migration preserves IDs and fields and is repeatable", async () => {
      const now = new Date();
      const legacy = { name: "Legacy", email: "legacy@example.com", phone: "+91 80071 26444", message: "Saved before migration", subject: "Legacy enquiry", source: "/contact.html", status: "new", createdAt: now, updatedAt: now };
      const { insertedId } = await db.collection("contact_submissions").insertOne(legacy);
      await migrateSubmissions(db);
      await migrateSubmissions(db);
      const migrated = await db.collection(collections.submissions).findOne({ _id: insertedId });
      assert.equal(migrated?.source, "contact");
      assert.equal(migrated?.fields.subject, legacy.subject);
      assert.equal(migrated?.fields.message, legacy.message);
      assert.deepEqual(migrated?.createdAt, now);
      assert.equal(await db.collection(collections.submissions).countDocuments({ _id: insertedId }), 1);
      assert.ok(await db.collection("contact_submissions").findOne({ _id: insertedId }));
      await db.collection(collections.submissions).updateOne({ _id: insertedId }, { $set: { status: "resolved" } });
      await assert.rejects(() => migrateSubmissions(db), /Migration conflict/);
    });
    await t.test("rate limit allows five concurrent requests per email and expires logically", async () => {
      const now = new Date("2036-01-01T00:01:00Z");
      const results = await Promise.allSettled(Array.from({ length: 12 }, () => checkSubmissionRate(db, contact, now)));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
      for (const result of results) if (result.status === "rejected") assert.ok(result.reason instanceof InquiryError && result.reason.status === 429);
      await checkSubmissionRate(db, contact, new Date(now.getTime() + 15 * 60 * 1000));
      const index = (await db.collection(collections.limits).indexes()).find((i) => i.name === "expiresAt_ttl");
      assert.equal(index?.expireAfterSeconds, 0);
    });
  } finally {
    // This database name is generated here; never drop a configured/user database.
    assert.match(databaseName, /^mewo_test_[a-f0-9]{32}$/);
    await db.dropDatabase();
    await client.close();
  }
});
