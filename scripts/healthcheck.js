import { getDb, closeMongoClient } from "../lib/db.js";
import { config } from "../lib/config.js";

async function main() {
  const db = await getDb();
  const collection = db.collection("healthcheck");

  const result = await collection.updateOne(
    { key: "initial-healthcheck" },
    {
      $setOnInsert: {
        key: "initial-healthcheck",
        status: "ok",
        createdAt: new Date(),
        source: "ullebets-unibet",
      },
      $set: {
        database: config.mongoDbName,
        collection: "healthcheck",
        verifiedAt: new Date(),
      },
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
        documentId: document?._id?.toString() ?? null,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeMongoClient());
