import { loadEnvConfig } from "@next/env";
import { MongoClient } from "mongodb";
import { mongoConfig } from "../lib/server/mongo-config";
import { initializeDatabase } from "../lib/server/mongo-schema";
import { migrateSubmissions } from "../lib/server/migrate-submissions";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const { uri, database, options } = mongoConfig();
  const client = new MongoClient(uri, options);
  try {
    await client.connect();
    const db = client.db(database);
    await initializeDatabase(db);
    for (const result of await migrateSubmissions(db)) {
      console.log(`Verified ${result.copied} legacy submissions from ${result.collection}; ${result.retained ? "originals retained for rollback" : "obsolete empty collection removed"}.`);
    }
    const names = await db.listCollections({}, { nameOnly: true }).toArray();
    console.log(`Initialized database: ${database}`);
    console.log(names.map((entry) => entry.name).sort().join("\n"));
  } finally { await client.close(); }
}
main().catch((error) => {
  console.error("Database setup failed:", error instanceof Error ? error.name : "UnknownError");
  process.exitCode = 1;
});
