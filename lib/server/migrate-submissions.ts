import { isDeepStrictEqual } from "node:util";
import { mkdir, open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { BSON, type Db, type Document } from "mongodb";
import { collections, initializeDatabase } from "./mongo-schema";

const targets = {
  contact: collections.contact,
  startup: collections.startup,
  subscription: collections.subscription,
} as const;
const legacy = ["submissions", "contact_submissions", "startup_submissions", "newsletter_subscriptions"];

function flatten(record: Document, source: keyof typeof targets): Document {
  const { fields, ...metadata } = record;
  const flat = { ...metadata, ...fields, source, sourceCompany: "MeWo" };
  if (source === "subscription" && !flat.status) flat.status = "subscribed";
  return flat;
}

export async function migrateSubmissions(db: Db) {
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  const sources = legacy.filter(name => names.has(name));
  const fromSource = (record: Document, name: string) =>
    name === "submissions" ? record.source : name === collections.contact ? "contact" :
    name === collections.startup ? "startup" : "subscription";
  let pending = names.has("submissions");
  for (const name of sources) {
    for await (const record of db.collection(name).find()) {
      const source = fromSource(record, name);
      if (!Object.hasOwn(targets, source)) throw new Error("Unknown submission source");
      if (name !== targets[source as keyof typeof targets] || !isDeepStrictEqual(record, flatten(record, source))) pending = true;
    }
  }
  if (!pending) return [];
  const directory = path.join(process.cwd(), ".reference", "mongodb-backups");
  await mkdir(directory, { recursive: true });
  const backup = path.join(directory, `form-collections-${randomUUID()}.ndjson`);
  const file = await open(backup, "wx", 0o600);
  try {
    await file.writeFile(BSON.EJSON.stringify({ format: 2, database: db.databaseName, collections: sources }) + "\n");
    const counts = new Map<string, number>();
    for (const name of sources) {
      let count = 0;
      for await (const record of db.collection(name).find()) {
        await file.writeFile(BSON.EJSON.stringify({ collection: name, document: record }, { relaxed: false }) + "\n");
        count++;
      }
      counts.set(name, count);
    }
    await file.sync();
    await initializeDatabase(db);
    const results: { collection: string; copied: number; retained: boolean }[] = [];
    for (const name of sources) {
      let copied = 0;
      for await (const record of db.collection(name).find()) {
        const source = fromSource(record, name) as keyof typeof targets;
        const target = db.collection(targets[source]);
        const expected = flatten(record, source);
        const existing = await target.findOne({ _id: record._id });
        if (existing && !isDeepStrictEqual(flatten(existing, source), expected)) throw new Error("Migration conflict");
        if (!existing) await target.insertOne(expected);
        else if (!isDeepStrictEqual(existing, expected)) {
          const result = await target.replaceOne(existing, expected);
          if (result.matchedCount !== 1) throw new Error("Concurrent submission change");
        }
        if (!isDeepStrictEqual(await target.findOne({ _id: record._id }), expected)) throw new Error("Migration verification failed");
        copied++;
      }
      results.push({ collection: name, copied, retained: name !== "submissions" });
    }
    if (names.has("submissions")) {
      if (await db.collection("submissions").countDocuments() !== counts.get("submissions")) throw new Error("Legacy collection changed");
      for await (const record of db.collection("submissions").find()) {
        const source = record.source as keyof typeof targets;
        const copy = await db.collection(targets[source]).findOne({ _id: record._id });
        if (!isDeepStrictEqual(copy, flatten(record, source))) throw new Error("Final copy verification failed");
      }
      await db.collection("submissions").drop();
    }
    return results;
  } finally {
    await file.close();
  }
}
