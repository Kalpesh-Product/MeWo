import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { mongoConfig } from "../lib/server/mongo-config";
import { collections } from "../lib/server/mongo-schema";
import { deleteAttachment } from "../lib/server/s3-attachments.mjs";

test("live form endpoint saves to local MongoDB and returns correct errors", async (t) => {
  loadEnvConfig(process.cwd(), true);
  const config = mongoConfig();
  // Explicitly limit this smoke test to the requested local database service.
  assert.match(config.uri, /^mongodb:\/\/(127\.0\.0\.1|localhost):27017(?:[/?]|$)/);
  const client = new MongoClient(config.uri, config.options);
  await client.connect();
  const db = client.db(config.database);
  const email = `mewo-http-${randomUUID()}@example.com`;
  const started = Date.now();
  const testUpload = process.env.TEST_S3_UPLOAD === "1";
  async function submit(kind: string, fields: Record<string, string> = {}, file?: File) {
    const data = new FormData();
    for (const [name, value] of Object.entries({ kind, name: "Backend HTTP verification", email, phone: "+91 80071 26444", message: "Temporary automated verification", ...fields })) data.set(name, value);
    if (file) data.set("presentation", file);
    return fetch("http://localhost:3012/api/inquiry", { method: "POST", headers: { Origin: "http://localhost:3012" }, body: data, signal: AbortSignal.timeout(60000) });
  }
  try {
    await t.test("contact, startup and duplicate newsletter submissions persist", async () => {
      const contact = await submit("contact", { subject: "Verification" });
      assert.equal(contact.status, 201, await contact.text());
      const startup = await submit("startup", { startup_name: "Test Startup", website_url: "https://example.com" }, testUpload ? new File(["%PDF-1.7\nTemporary test"], "verification.pdf", { type: "application/pdf" }) : undefined);
      assert.equal(startup.status, 201, await startup.text());
      for (let i = 0; i < 2; i++) {
        const subscription = await submit("subscription");
        assert.equal(subscription.status, 200, await subscription.text());
      }
      for (const source of ["contact", "startup", "subscription"]) {
        assert.equal(await db.collection(source === "contact" ? collections.contact : source === "startup" ? collections.startup : collections.subscription).countDocuments({ email }), 1);
      }
      const record = await db.collection(collections.startup).findOne({ email });
      if (testUpload) assert.ok(record?.presentation.presentationLink);
      else assert.equal(record?.presentation, undefined);
    });
    await t.test("read API rejects unauthenticated requests and unapproved browser origins", async () => {
      const endpoint = "http://localhost:3012/api/submissions";
      assert.equal((await fetch(endpoint)).status, 401);
      assert.equal((await fetch(endpoint, { headers: { Authorization: "Bearer invalid" } })).status, 401);
      assert.equal((await fetch(endpoint, { headers: { Origin: "https://unrelated.example" } })).status, 403);
      const preflight = await fetch(endpoint, { method: "OPTIONS", headers: { Origin: "http://localhost:3012", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "http://localhost:3012");
      assert.match(preflight.headers.get("Access-Control-Allow-Headers") || "", /Authorization/);
    });
    await t.test("read API returns flat table rows, counts, filters and stable pagination", async () => {
      assert.ok(process.env.MEWO_SUBMISSIONS_API_KEY, "Configure the read API key before running HTTP tests.");
      const headers = { Authorization: `Bearer ${process.env.MEWO_SUBMISSIONS_API_KEY}` };
      const endpoint = "http://localhost:3012/api/submissions";
      const response = await fetch(`${endpoint}?${new URLSearchParams({ search: email, pageSize: "2", sortBy: "source", sortOrder: "asc" })}`, { headers });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("Cache-Control") || "", /no-store/);
      const first = await response.json();
      assert.equal(first.data.length, 2);
      assert.equal(first.pagination.filteredTotal, 3);
      assert.equal(first.pagination.hasNextPage, true);
      const second = await (await fetch(`${endpoint}?${new URLSearchParams({ search: email, pageSize: "2", page: "2", sortBy: "source", sortOrder: "asc" })}`, { headers })).json();
      assert.equal(second.data.length, 1);
      assert.equal(second.pagination.hasNextPage, false);
      const rows = [...first.data, ...second.data];
      assert.equal(new Set(rows.map((row) => row.id)).size, 3);
      assert.deepEqual(rows.map((row) => row.source), ["contact", "startup", "subscription"]);
      for (const row of rows) {
        assert.equal(row.email, email);
        assert.equal(row.sourceCompany, "MeWo");
        assert.equal(row.fields, undefined);
        assert.equal(row._id, undefined);
        assert.ok(!Number.isNaN(Date.parse(row.createdAt)));
      }
      if (testUpload) {
        assert.equal(rows[1].presentation.filename, "verification.pdf");
        assert.ok(rows[1].presentation.presentationLink);
        assert.equal(rows[1].presentation.sha256, undefined);
      } else {
        assert.equal(rows[1].presentation, null);
      }
      assert.equal(rows[2].name, null);
      const filtered = await (await fetch(`${endpoint}?${new URLSearchParams({ search: email, source: "startup", status: "new" })}`, { headers })).json();
      assert.equal(filtered.pagination.filteredTotal, 1);
      assert.equal(filtered.data[0].source, "startup");
      for (const kind of ["contact", "startup", "subscription"]) {
        const response = await fetch(`${endpoint}?${new URLSearchParams({ search: email, kind })}`, { headers });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.pagination.filteredTotal, 1);
        assert.equal(result.data.length, 1);
        assert.equal(result.data[0].source, kind);
      }
      assert.equal((await fetch(`${endpoint}?kind=contact&source=startup`, { headers })).status, 400);
      assert.equal((await fetch(`${endpoint}?kind=unknown`, { headers })).status, 400);
      const literal = await (await fetch(`${endpoint}?${new URLSearchParams({ search: `${email}.*` })}`, { headers })).json();
      assert.equal(literal.data.length, 0);
      assert.equal((await fetch(`${endpoint}?sortBy=$where`, { headers })).status, 400);
      assert.equal((await fetch(`${endpoint}?pageSize=101`, { headers })).status, 400);
    });
    await t.test("patch edits all three sources using their listed IDs", async () => {
      assert.ok(process.env.MEWO_SUBMISSIONS_WRITE_API_KEY, "Configure the write API key before running HTTP tests.");
      const endpoint = "http://localhost:3012/api/submissions";
      const readAuth = "Bearer " + process.env.MEWO_SUBMISSIONS_API_KEY;
      const writeAuth = "Bearer " + process.env.MEWO_SUBMISSIONS_WRITE_API_KEY;
      const listed = await fetch(endpoint + "?search=" + encodeURIComponent(email), { headers: { Authorization: readAuth } });
      assert.equal(listed.status, 200);
      const {data} = await listed.json();
      const find = (source: string) => data.find((row: {source: string}) => row.source === source);
      const contact = find("contact"), startup = find("startup"), subscription = find("subscription");
      const patch = (source: string, id: string, edits: object, authorization = writeAuth) => fetch(endpoint + "/" + source + "/" + id, {
        method: "PATCH", headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify(edits),
      });
      assert.equal((await patch("contact", contact.id, { name: "Fixture edit" }, readAuth)).status, 401);
      assert.equal((await patch("startup", contact.id, { name: "Fixture edit" })).status, 404);
      assert.equal((await patch("contact", "not-an-id", { name: "Fixture edit" })).status, 400);
      assert.equal((await patch("contact", contact.id, { phone: "broken" })).status, 400);
      assert.equal((await patch("startup", startup.id, { websiteUrl: "javascript:alert(1)" })).status, 400);
      assert.equal((await patch("startup", startup.id, { presentation: null })).status, 400);
      assert.equal((await patch("subscription", subscription.id, { status: "resolved" })).status, 400);
      assert.equal((await patch("contact", contact.id, {})).status, 400);
      const opts = await fetch(endpoint + "/contact/" + contact.id, {
        method: "OPTIONS", headers: { Origin: "http://localhost:3012", "Access-Control-Request-Method": "PATCH" },
      });
      assert.equal(opts.status, 204);
      assert.match(opts.headers.get("access-control-allow-methods") ?? "", /PATCH/);
      for (const [row, fields] of [
        [contact, { status: "in_progress", subject: "Updated subject" }],
        [startup, { startupName: "Updated startup" }],
        [subscription, { status: "unsubscribed" }],
      ] as const) {
        const saved = await patch(row.source, row.id, fields);
        assert.equal(saved.status, 200);
        const {data: updated} = await saved.json();
        assert.equal(updated.id, row.id);
        assert.equal(updated.email, row.email);
        assert.equal(updated.createdAt, row.createdAt);
        assert.equal(updated.websiteUrl, row.websiteUrl);
        assert.deepEqual(updated.presentation, row.presentation);
        for (const [name, value] of Object.entries(fields)) assert.equal(updated[name], value);
      }
    });
    await t.test("invalid fields and attachments do not insert records", async () => {
      assert.equal((await submit("contact", { phone: "bad" })).status, 422);
      assert.equal((await submit("startup", {}, new File(["not a pdf"], "bad.pdf"))).status, 415);
      assert.equal(await Promise.all([collections.contact, collections.startup, collections.subscription].map(name => db.collection(name).countDocuments({ email }))).then(counts => counts.reduce((sum, count) => sum + count, 0)), 3);
    });
    await t.test("honeypot submissions do not insert records", async () => {
      assert.equal((await submit("contact", { fax_number: "bot" })).status, 202);
      assert.equal(await db.collection(collections.contact).countDocuments({ email }), 1);
    });
    await t.test("cross-origin writes, JSON bodies and public reads are rejected", async () => {
      assert.equal((await fetch("http://localhost:3012/api/inquiry", { method: "POST", headers: { Origin: "https://unrelated.example" } })).status, 403);
      assert.equal((await fetch("http://localhost:3012/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 415);
      assert.equal((await fetch("http://localhost:3012/api/inquiry")).status, 405);
    });
    await t.test("sixth contact attempt is rate limited", async () => {
      for (let i = 0; i < 4; i++) assert.equal((await submit("contact")).status, 201);
      const limited = await submit("contact");
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers.get("Retry-After")) > 0);
      assert.equal(await db.collection(collections.contact).countDocuments({ email }), 5);
    });
  } finally {
    for await (const record of db.collection(collections.startup).find({ email })) {
      if (record.presentation?.presentationLink) await deleteAttachment(record.presentation.presentationLink);
    }
    for (const name of [collections.contact, collections.startup, collections.subscription]) await db.collection(name).deleteMany({ email });
    const window = 15 * 60 * 1000;
    const keys: string[] = [];
    for (const kind of ["contact", "startup", "subscription"]) {
      for (let end = (Math.floor(started / window) + 1) * window; end <= (Math.floor(Date.now() / window) + 1) * window; end += window) {
        keys.push(createHash("sha256").update(`${kind}:${email}:${end}`).digest("hex"));
      }
    }
    await db.collection<{ _id: string }>(collections.limits).deleteMany({ _id: { $in: keys } });
    await client.close();
  }
});
