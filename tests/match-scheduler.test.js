import test from "node:test";
import assert from "node:assert/strict";

import { buildSnapshotJobs } from "../lib/match-scheduler.js";

test("buildSnapshotJobs returns FIRST_SEEN through MATCH_DAY checkpoints", () => {
  const jobs = buildSnapshotJobs(
    {
      matchId: "101",
      kickoffAt: "2026-10-21T18:00:00.000Z",
      matchDate: "2026-10-21",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
    },
    "2026-10-10T09:30:00.000Z"
  );

  assert.deepEqual(
    jobs.map((job) => job.snapshotLabel),
    ["FIRST_SEEN", "T_MINUS_3D", "T_MINUS_2D", "T_MINUS_1D", "MATCH_DAY"]
  );
  assert.equal(jobs[0].dueAt, "2026-10-10T09:30:00.000Z");
  assert.equal(jobs[1].dueAt, "2026-10-18T18:00:00.000Z");
  assert.equal(jobs[2].dueAt, "2026-10-19T18:00:00.000Z");
  assert.equal(jobs[3].dueAt, "2026-10-20T18:00:00.000Z");
  assert.equal(jobs[4].dueAt, "2026-10-21T00:00:00.000Z");
});
