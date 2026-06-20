import test from "node:test";
import assert from "node:assert/strict";

import { buildRawOddsSnapshot } from "../lib/raw-odds-snapshots.js";

test("buildRawOddsSnapshot keeps the full payload and computes counts and hash", () => {
  const payload = {
    event: { id: 12345 },
    betOffers: [
      {
        criterion: { label: "Antal skott" },
        outcomes: [
          { label: "Over", odds: 1900, line: 10500 },
          { label: "Under", odds: 1900, line: 10500 },
        ],
      },
      {
        criterion: { label: "Antal hörnor" },
        outcomes: [{ label: "Over", odds: 2100, line: 9500 }],
      },
    ],
  };

  const snapshot = buildRawOddsSnapshot({
    match: {
      _id: "507f1f77bcf86cd799439011",
      matchId: "101",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
      leagueName: "Premier League",
    },
    job: {
      _id: "507f191e810c19729de860ea",
      snapshotLabel: "T_MINUS_1D",
    },
    payload,
    unibetEventId: "12345",
    matched: true,
    fetchedAt: "2026-10-20T18:30:00.000Z",
  });

  assert.equal(snapshot.snapshot_label, "T_MINUS_1D");
  assert.equal(snapshot.unibet_event_id, "12345");
  assert.equal(snapshot.market_count, 2);
  assert.equal(snapshot.selection_count, 3);
  assert.equal(snapshot.matched, true);
  assert.equal(snapshot.fetched_at, "2026-10-20T18:30:00.000Z");
  assert.deepEqual(snapshot.payload, payload);
  assert.match(snapshot.payload_hash, /^[a-f0-9]{64}$/);
  assert.ok(snapshot.payload_size_bytes > 0);
});
