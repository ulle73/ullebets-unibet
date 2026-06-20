import test from "node:test";
import assert from "node:assert/strict";

import { selectLeagueConfigs } from "../lib/unibet-kambi.js";

test("selectLeagueConfigs returns the matching league when source league exists", () => {
  const configs = {
    "Premier League": {
      baseUrl: "https://example.com/premier",
    },
    "La Liga": {
      baseUrl: "https://example.com/laliga",
      lookupSlugs: ["laliga"],
    },
  };

  const selected = selectLeagueConfigs(configs, "LaLiga");
  assert.deepEqual(selected, [configs["La Liga"]]);
});

test("selectLeagueConfigs falls back to every configured league when source league is missing", () => {
  const configs = {
    "Premier League": {
      baseUrl: "https://example.com/premier",
    },
    "La Liga": {
      baseUrl: "https://example.com/laliga",
    },
  };

  const selected = selectLeagueConfigs(configs, null);
  assert.deepEqual(selected, [configs["Premier League"], configs["La Liga"]]);
});
