import { getDb, closeMongoClient } from "../lib/db.js";
import { getSourceDb, closeSourceDb, getSourceDbName } from "../lib/source-db.js";
import { config } from "../lib/config.js";
import { normalizeTeamstatsMatch } from "../lib/ullebets-vecel/normalize-teamstats.js";
import { scheduleOddsJobsForMatch } from "../lib/jobs.js";

async function upsertMatch(db, event) {
  const now = new Date();
  return db.collection("matches").findOneAndUpdate(
    { source: event.source, source_event_id: event.source_event_id },
    {
      $setOnInsert: { first_seen_at: now, created_at: now },
      $set: { ...event, status: "scheduled", last_seen_at: now, updated_at: now },
    },
    { upsert: true, returnDocument: "after" }
  );
}

async function main() {
  const targetDb = await getDb();
  const sourceDb = await getSourceDb();
  const now = new Date();
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const cursor = sourceDb.collection("teamstats").find({}, { projection: { full: 1, _importMeta: 1 } });

  const seen = new Set();
  let docs = 0;
  let scanned = 0;
  let normalized = 0;
  let future = 0;
  let upserted = 0;
  let jobs = 0;

  for await (const doc of cursor) {
    docs += 1;
    const list = Array.isArray(doc.full) ? doc.full : [];
    for (const rawMatch of list) {
      scanned += 1;
      const event = normalizeTeamstatsMatch(rawMatch, doc);
      if (!event) continue;
      normalized += 1;
      if (event.start_time < now || event.start_time > to) continue;
      if (seen.has(event.source_event_id)) continue;
      seen.add(event.source_event_id);
      future += 1;

      const match = await upsertMatch(targetDb, event);
      upserted += 1;
      jobs += await scheduleOddsJobsForMatch(match);
      if (upserted >= config.maxMatchesPerRun) break;
    }
    if (upserted >= config.maxMatchesPerRun) break;
  }

  console.log({
    ok: true,
    sourceDatabase: getSourceDbName(),
    sourceCollection: "teamstats",
    targetDatabase: targetDb.databaseName,
    docs,
    scanned,
    normalized,
    future,
    upserted,
    jobs,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await closeSourceDb();
  await closeMongoClient();
});
