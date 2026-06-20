import test from "node:test";
import assert from "node:assert/strict";

import packageJson from "../package.json" with { type: "json" };

test("package.json exposes the required pipeline scripts", () => {
  assert.equal(packageJson.scripts.indexes, "node scripts/indexes.js");
  assert.equal(packageJson.scripts["source:scan"], "node scripts/source-scan.js");
  assert.equal(packageJson.scripts["import:matches"], "node scripts/import-matches.js");
  assert.equal(packageJson.scripts["odds:raw"], "node scripts/odds-raw.js");
  assert.equal(packageJson.scripts.coverage, "node scripts/coverage.js");
});
