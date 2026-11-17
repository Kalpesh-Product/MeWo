import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { test } from "node:test";
import { MongoClient, ObjectId } from "mongodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { initializeDatabase, collections } from "../lib/server/mongo-schema";
import { saveInquiry } from "../lib/server/inquiry-storage";
import { parseInquiry, parsePresentation } from "../lib/server/inquiry-validation";
import { migrateSubmissions } from "../lib/server/migrate-submissions";
import { readSubmissions, parseSubmissionsQuery } from "../lib/server/submissions-reader";
import { mongoConfig } from "../lib/server/mongo-config";

test("three form collections store flat answers and sourceCompany", async (t) => {
  loadEnvConfig(process.cwd(), true);
  const name = `mewo_test_${randomUUID().replaceAll("-", "")}`;
  const config = mongoConfig();
  const client = new MongoClient(config.uri, config.options);
  await client.connect();
  const db = client.db(name);
  try {
    await initializeDatabase(db);
    const input = new FormData();
    for (const [key, value] of Object.entries({
      kind: "contact", name: "Test Name", email: "test@example.test",
      phone: "9876543210", message: "Test message",
    })) input.set(key, value);
    await saveInquiry(db, parseInquiry(input));
    const contact = await db.collection(collections.contact).findOne({ email: "test@example.test" });
    assert.equal(contact?.name, "Test Name");
    assert.equal(contact?.sourceCompany, "MeWo");
    assert.equal(contact?.fields, undefined);

    await Promise.all(Array.from({ length: 4 }, () =>
      saveInquiry(db, { kind: "subscription", email: "subscriber@example.test" })));
    assert.equal(await db.collection(collections.subscription).countDocuments(), 1);
    assert.equal((await db.collection(collections.subscription).findOne())?.sourceCompany, "MeWo");

    const previousKey = process.env.AWS_ACCESS_KEY_ID;
    const previousSecret = process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_ACCESS_KEY_ID = "test";
    process.env.AWS_SECRET_ACCESS_KEY = "test";
    const send = t.mock.method(S3Client.prototype, "send", async () => ({}));
    try {
      input.set("kind", "startup");
      input.set("startup_name", "Example Startup");
      const bytes = Buffer.from("%PDF-1.7\nTest presentation\n%%EOF");
      input.set("presentation", new File([bytes], "deck.pdf", { type: "application/pdf" }));
      const inquiry = parseInquiry(input);
      await saveInquiry(db, inquiry, await parsePresentation(input, inquiry.kind));
      const startup = await db.collection(collections.startup).findOne({ email: "test@example.test" });
      assert.equal(startup?.startupName, "Example Startup");
      assert.equal(startup?.sourceCompany, "MeWo");
      assert.equal(startup?.fields, undefined);
      assert.equal(startup?.presentation.size, bytes.length);
      const command = send.mock.calls[0].arguments[0] as PutObjectCommand;
      assert.ok(command instanceof PutObjectCommand);
      assert.equal(command.input.Bucket, "wonov-aws-s3-storage");
      assert.deepEqual(command.input.Body, bytes);
      assert.ok(startup?.presentation.presentationLink);
    } finally {
      send.mock.restore();
      if (previousKey === undefined) delete process.env.AWS_ACCESS_KEY_ID;
      else process.env.AWS_ACCESS_KEY_ID = previousKey;
      if (previousSecret === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
      else process.env.AWS_SECRET_ACCESS_KEY = previousSecret;
    }

    const rows = await readSubmissions(db, parseSubmissionsQuery(new URLSearchParams()));
    assert.equal(rows.pagination.total, 3);
    assert.ok(rows.data.every(row => row.sourceCompany === "MeWo"));
    assert.equal((await readSubmissions(db,
      parseSubmissionsQuery(new URLSearchParams("kind=startup")))).pagination.filteredTotal, 1);

    const legacyId = new ObjectId();
    await db.collection(collections.submissions).insertOne({
      _id: legacyId, source: "contact", status: "new",
      fields: { name: "Legacy", email: "legacy@example.test", phone: "9876543210", message: "Old" },
      createdAt: new Date(), updatedAt: new Date(),
    });
    await migrateSubmissions(db);
    const migrated = await db.collection(collections.contact).findOne({ _id: legacyId });
    assert.equal(migrated?.name, "Legacy");
    assert.equal(migrated?.sourceCompany, "MeWo");
    assert.equal(migrated?.fields, undefined);
    assert.equal(await db.listCollections({ name: collections.submissions }).hasNext(), false);
    assert.deepEqual(await migrateSubmissions(db), []);
  } finally {
    assert.match(name, /^mewo_test_[a-f0-9]{32}$/);
    await db.dropDatabase();
    await client.close();
  }
});
