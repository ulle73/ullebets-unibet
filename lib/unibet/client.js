import { config } from "../config.js";

function fillTemplate(template, values) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = values[key];
    return encodeURIComponent(value == null ? "" : String(value));
  });
}

async function fetchJson(url) {
  const headers = {
    accept: "application/json,text/plain,*/*",
    "user-agent": config.unibetUserAgent,
  };

  if (config.unibetCookie) headers.cookie = config.unibetCookie;

  const response = await fetch(url, { headers });
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { rawText: text };
  }

  return {
    request_url: url,
    request_params: {},
    response_status: response.status,
    response_headers: Object.fromEntries(response.headers.entries()),
    payload,
  };
}

export async function fetchUnibetLeagueDiscovery({ league, from, to }) {
  const template = league?.sources?.unibet?.discovery_url || config.unibetDiscoveryUrlTemplate;
  if (!template) {
    throw new Error(
      "Missing Unibet discovery URL template. Set league.sources.unibet.discovery_url or UNIBET_DISCOVERY_URL_TEMPLATE."
    );
  }

  const url = fillTemplate(template, {
    league_slug: league?.sources?.unibet?.league_slug || league?.league_slug || league?.key,
    league_id: league?.sources?.unibet?.league_id || league?.league_id || "",
    from: from.toISOString(),
    to: to.toISOString(),
  });

  return fetchJson(url);
}

export async function fetchUnibetEventOdds({ match }) {
  const template = match?.odds_url || config.unibetEventOddsUrlTemplate;
  if (!template) {
    throw new Error(
      "Missing Unibet event odds URL template. Set UNIBET_EVENT_ODDS_URL_TEMPLATE or save odds_url on match."
    );
  }

  const url = fillTemplate(template, {
    event_id: match.source_event_id,
    source_event_id: match.source_event_id,
    league_key: match.league_key,
  });

  return fetchJson(url);
}
