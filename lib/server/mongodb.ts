import "server-only";
import { MongoClient, type Db } from "mongodb";
import { mongoConfig } from "./mongo-config";
import { initializeDatabase } from "./mongo-schema";

const globalMongo = globalThis as typeof globalThis & {
  mewoMongo?: { key: string; client: MongoClient; ready: Promise<Db> };
};

export function getDatabase(): Promise<Db> {
  const { uri, database, options } = mongoConfig();
  const key = JSON.stringify({ uri, database, options, schema: "submissions-v2" });
  if (globalMongo.mewoMongo?.key === key) return globalMongo.mewoMongo.ready;
  const client = new MongoClient(uri, {
    appName: "mewo-website", ...options,
    writeConcern: { w: "majority", journal: true },
  });
  const ready = (async () => {
    await client.connect();
    const db = client.db(database);
    await initializeDatabase(db);
    return db;
  })().catch(async (error) => {
    if (globalMongo.mewoMongo?.client === client) globalMongo.mewoMongo = undefined;
    await client.close().catch(() => {});
    throw error;
  });
  globalMongo.mewoMongo = { key, client, ready };
  return ready;
}
