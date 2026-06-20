import { MongoClient } from "mongodb";
import { config, requireMongoConfig, assertSafeDatabaseName } from "./config.js";

let mongoClientPromise;

export function getMongoClient() {
  requireMongoConfig();

  if (!mongoClientPromise) {
    const client = new MongoClient(config.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    mongoClientPromise = client.connect();
  }

  return mongoClientPromise;
}

export async function getDb() {
  assertSafeDatabaseName(config.mongoDbName);
  const client = await getMongoClient();
  return client.db(config.mongoDbName);
}

export async function closeMongoClient() {
  if (!mongoClientPromise) return;
  const client = await mongoClientPromise;
  await client.close();
  mongoClientPromise = undefined;
}

export const clientPromise = getMongoClient();
export default clientPromise;
