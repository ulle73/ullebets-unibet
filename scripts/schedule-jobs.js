import { getDb, closeMongoClient } from "../lib/db.js";
import { scheduleOddsJobsForMatch } from "../lib/jobs.js";

async function main() {
  const db = await getDb();
  const cursor = db.collection("matches").find({
    source: "unibet",
    start_time: { $gt: new Date() },
  });

  let matches = 0;
  let jobs = 0;

  for await (const match of cursor) {
    matches += 1;
    jobs += await scheduleOddsJobsForMatch(match);
  }

  console.log({ ok: true, database: db.databaseName, matches, jobs });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
