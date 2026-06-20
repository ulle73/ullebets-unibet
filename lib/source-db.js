import { MongoClient } from "mongodb";
import { config } from "./config.js";

let sourceClientPromise;

export function getSourceDbName() {
  return process.env.SOURCE_MONGODB_DB || "app";
}

export async function getSourceDb() {
  if (!config.mongoUri) throw new Error("Missing MONGODB_URI");
  if (!sourceClientPromise) {
    const client = new MongoClient(config.mongoUri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
    sourceClientPromise = client.connect();
  }
  const client = await sourceClientPromise;
  return client.db(getSourceDbName());
}

export async function closeSourceDb() {
  if (!sourceClientPromise) return;
  const client = await sourceClientPromise;
  await client.close();
  sourceClientPromise = undefined;
}
