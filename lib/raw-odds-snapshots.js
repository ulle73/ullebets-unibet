import crypto from "node:crypto";

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function countSelections(payload) {
  const betOffers = Array.isArray(payload?.betOffers) ? payload.betOffers : [];
  return betOffers.reduce((total, offer) => {
    const outcomes = Array.isArray(offer?.outcomes) ? offer.outcomes : [];
    return total + outcomes.length;
  }, 0);
}

export function buildRawOddsSnapshot({ match, job, payload, unibetEventId, matched, fetchedAt }) {
  const payloadJson = stableStringify(payload);
  return {
    _id: `${job._id}`,
    match_id: match._id,
    source_match_id: match.matchId,
    odds_fetch_job_id: job._id,
    snapshot_label: job.snapshotLabel,
    payload_hash: crypto.createHash("sha256").update(payloadJson).digest("hex"),
    payload_size_bytes: Buffer.byteLength(payloadJson, "utf8"),
    market_count: Array.isArray(payload?.betOffers) ? payload.betOffers.length : 0,
    selection_count: countSelections(payload),
    unibet_event_id: unibetEventId ? String(unibetEventId) : null,
    matched: Boolean(matched),
    fetched_at: fetchedAt,
    home_team_name: match.homeTeamName,
    away_team_name: match.awayTeamName,
    league_name: match.leagueName || null,
    payload,
  };
}
