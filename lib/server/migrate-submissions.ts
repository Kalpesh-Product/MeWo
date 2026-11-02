import { isDeepStrictEqual } from "node:util";
import type { Db, Document } from "mongodb";
import { collections } from "./mongo-schema";

const legacy = [
  { name: "contact_submissions", source: "contact", fields: ["name", "email", "phone", "subject", "message"] },
  { name: "startup_submissions", source: "startup", fields: ["name", "email", "phone", "message", "startupName", "websiteUrl", "linkedinProfileUrl", "presentation"] },
  { name: "newsletter_subscriptions", source: "subscription", fields: ["email"] },
] as const;

// Preserve IDs so existing GridFS submission references remain valid. Keep legacy
// records as a rollback copy; never silently overwrite a conflicting target.
export async function migrateSubmissions(db: Db) {
  const results: { collection: string; copied: number; retained: boolean }[] = [];
  for (const entry of legacy) {
    if (!await db.listCollections({ name: entry.name }, { nameOnly: true }).hasNext()) continue;
    const old = db.collection(entry.name);
    let copied = 0;
    for await (const record of old.find()) {
      const fields: Document = {};
      for (const key of entry.fields) if (record[key] !== undefined) fields[key] = record[key];
      const document = {
        _id: record._id, source: entry.source, fields, status: record.status,
        createdAt: record.createdAt, updatedAt: record.updatedAt,
      };
      const target = db.collection(collections.submissions);
      const existing = await target.findOne({ _id: record._id });
      if (existing && !isDeepStrictEqual(existing, document)) {
        throw new Error("Migration conflict: existing submission differs; legacy record preserved.");
      }
      await target.updateOne({ _id: record._id }, { $setOnInsert: document }, { upsert: true });
      if (!isDeepStrictEqual(await target.findOne({ _id: record._id }), document)) {
        throw new Error("Migration verification failed; legacy record preserved.");
      }
      copied++;
    }
    // Obsolete empty collections contain no records or rollback data to keep.
    const retained = copied > 0 || await old.countDocuments({}, { limit: 1 }) > 0;
    if (!retained) await old.drop();
    results.push({ collection: entry.name, copied, retained });
  }
  return results;
}
