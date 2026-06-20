export const ODDS_SNAPSHOT_PLAN = [
  { label: "FIRST_SEEN", minutesBeforeStart: null },
  { label: "T_MINUS_3D", minutesBeforeStart: 3 * 24 * 60 },
  { label: "T_MINUS_2D", minutesBeforeStart: 2 * 24 * 60 },
  { label: "T_MINUS_1D", minutesBeforeStart: 24 * 60 },
  { label: "T_MINUS_12H", minutesBeforeStart: 12 * 60 },
  { label: "T_MINUS_6H", minutesBeforeStart: 6 * 60 },
  { label: "T_MINUS_1H", minutesBeforeStart: 60 },
  { label: "T_MINUS_10M", minutesBeforeStart: 10 },
];

export function nowUtc() {
  return new Date();
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function minutesBefore(startTime, minutes) {
  return new Date(startTime.getTime() - minutes * 60 * 1000);
}

export function buildOddsJobTimes(startTime, seenAt = nowUtc()) {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid startTime: ${startTime}`);

  return ODDS_SNAPSHOT_PLAN.map((item) => {
    const dueAt = item.label === "FIRST_SEEN" ? seenAt : minutesBefore(start, item.minutesBeforeStart);
    return { snapshot_label: item.label, due_at: dueAt };
  }).filter((job) => job.snapshot_label === "FIRST_SEEN" || job.due_at > seenAt);
}

export function secondsBeforeStart(startTime, fetchedAt = nowUtc()) {
  return Math.floor((new Date(startTime).getTime() - new Date(fetchedAt).getTime()) / 1000);
}
