import { MongoClient } from "mongodb";
import { config, requireMongoConfig, assertSafeDatabaseName } from "./config.js";

let clientPromise;

export function getMongoClient() {
  requireMongoConfig();

  if (!clientPromise) {
    const client = new MongoClient(config.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb() {
  assertSafeDatabaseName(config.mongoDbName);
  const client = await getMongoClient();
  return client.db(config.mongoDbName);
}

export async function closeMongoClient() {
  if (!clientPromise) return;
  const client = await clientPromise;
  await client.close();
  clientPromise = undefined;
}
