import { getDb, closeMongoClient } from "../lib/db.js";
import { config } from "../lib/config.js";

async function main() {
  const db = await getDb();
  const collection = db.collection("healthcheck");

  const res = await collection.updateOne(
    { _id: "healthcheck" },
    {
      $set: {
        database: config.mongoDbName,
        collection: "healthcheck",
        checked_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true }
  );

  console.log({
    ok: true,
    database: db.databaseName,
    collection: collection.collectionName,
    acknowledged: res.acknowledged,
    upsertedCount: res.upsertedCount,
    matchedCount: res.matchedCount,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeMongoClient());
