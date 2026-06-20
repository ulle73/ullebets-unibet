import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { clientPromise } from "../lib/db.js";
import { resolveTargetDbName } from "../lib/config.js";

const dbName = resolveTargetDbName();

const client = await clientPromise;
const db = client.db(dbName);
const collection = db.collection("healthcheck");

const result = await collection.updateOne(
  { key: "initial-healthcheck" },
  {
    $setOnInsert: {
      key: "initial-healthcheck",
      status: "ok",
      createdAt: new Date(),
      source: "ullebets-unibet"
    },
    $set: {
      verifiedAt: new Date()
    }
  },
  { upsert: true }
);

const document = await collection.findOne({ key: "initial-healthcheck" });

console.log(
  JSON.stringify(
    {
      database: db.databaseName,
      collection: collection.collectionName,
      acknowledged: result.acknowledged,
      upsertedCount: result.upsertedCount,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      documentId: document?._id?.toString() ?? null
    },
    null,
    2
  )
);

await client.close();
