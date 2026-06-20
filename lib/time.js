export const ODDS_SNAPSHOT_PLAN = [
  { label: "FIRST_SEEN", dayOffset: null },
  { label: "T_MINUS_3D", dayOffset: -3 },
  { label: "T_MINUS_2D", dayOffset: -2 },
  { label: "T_MINUS_1D", dayOffset: -1 },
  { label: "MATCH_DAY", dayOffset: 0 },
];

export function nowUtc() {
  return new Date();
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function utcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
}

function snapshotDay(startTime, dayOffset) {
  return addDays(utcDayStart(startTime), dayOffset);
}

export function buildOddsJobTimes(startTime, seenAt = nowUtc()) {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid startTime: ${startTime}`);

  return ODDS_SNAPSHOT_PLAN.map((item) => {
    const dueAt = item.label === "FIRST_SEEN" ? seenAt : snapshotDay(start, item.dayOffset);
    return { snapshot_label: item.label, due_at: dueAt };
  }).filter((job) => job.snapshot_label === "FIRST_SEEN" || job.due_at > seenAt);
}

export function secondsBeforeStart(startTime, fetchedAt = nowUtc()) {
  return Math.floor((new Date(startTime).getTime() - new Date(fetchedAt).getTime()) / 1000);
}
