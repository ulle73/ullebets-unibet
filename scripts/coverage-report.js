import { getDb, closeMongoClient } from "../lib/db.js";

function keyFor(doc) {
  return `${doc.league_key || "unknown"}__${doc.snapshot_label || "unknown"}`;
}

async function main() {
  const db = await getDb();
  const since = process.env.SINCE ? new Date(process.env.SINCE) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const docs = await db.collection("raw_odds_snapshots").find({ fetched_at: { $gte: since } }).toArray();
  const groups = new Map();

  for (const doc of docs) {
    const key = keyFor(doc);
    if (!groups.has(key)) {
      groups.set(key, {
        league_key: doc.league_key || "unknown",
        snapshot_label: doc.snapshot_label || "unknown",
        snapshots: 0,
        payloadBytes: 0,
        markets: 0,
        selections: 0,
        shots: 0,
        shotsOnTarget: 0,
        corners: 0,
        halves: 0,
      });
    }

    const row = groups.get(key);
    row.snapshots += 1;
    row.payloadBytes += doc.payload_size_bytes || 0;
    row.markets += doc.market_count || 0;
    row.selections += doc.selection_count || 0;
    row.shots += doc.coverage?.has_shots ? 1 : 0;
    row.shotsOnTarget += doc.coverage?.has_shots_on_target ? 1 : 0;
    row.corners += doc.coverage?.has_corners ? 1 : 0;
    row.halves += doc.coverage?.has_halves ? 1 : 0;
  }

  const rows = [...groups.values()].map((row) => ({
    ...row,
    avgPayloadMb: row.snapshots ? Number((row.payloadBytes / row.snapshots / 1024 / 1024).toFixed(3)) : 0,
    avgMarkets: row.snapshots ? Number((row.markets / row.snapshots).toFixed(1)) : 0,
    avgSelections: row.snapshots ? Number((row.selections / row.snapshots).toFixed(1)) : 0,
  })).sort((a, b) => `${a.league_key}${a.snapshot_label}`.localeCompare(`${b.league_key}${b.snapshot_label}`));

  const report = {
    created_at: new Date(),
    since,
    rows,
    totals: {
      snapshots: docs.length,
      totalPayloadMb: Number((docs.reduce((sum, doc) => sum + (doc.payload_size_bytes || 0), 0) / 1024 / 1024).toFixed(3)),
    },
  };

  await db.collection("coverage_reports").insertOne(report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
