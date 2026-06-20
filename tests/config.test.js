import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTargetDbName,
  resolveSourceDbName,
  resolveReferenceNow,
  resolveOptionalLimit,
} from "../lib/config.js";

test("resolveTargetDbName rejects app as the target database", () => {
  assert.throws(
    () => resolveTargetDbName({ MONGODB_DB: "app" }),
    /ullebets_unibet/
  );
});

test("resolveTargetDbName returns ullebets_unibet when configured", () => {
  assert.equal(
    resolveTargetDbName({ MONGODB_DB: "ullebets_unibet" }),
    "ullebets_unibet"
  );
});

test("resolveSourceDbName always points at app", () => {
  assert.equal(resolveSourceDbName(), "app");
});

test("resolveReferenceNow uses NOW_ISO when it is valid", () => {
  assert.equal(
    resolveReferenceNow({ NOW_ISO: "2026-05-29T12:00:00.000Z" }),
    "2026-05-29T12:00:00.000Z"
  );
});

test("resolveReferenceNow rejects invalid NOW_ISO values", () => {
  assert.throws(
    () => resolveReferenceNow({ NOW_ISO: "not-a-date" }),
    /NOW_ISO/
  );
});

test("resolveOptionalLimit parses positive integers and ignores missing values", () => {
  assert.equal(resolveOptionalLimit("IMPORT_MATCH_LIMIT", {}), null);
  assert.equal(
    resolveOptionalLimit("IMPORT_MATCH_LIMIT", { IMPORT_MATCH_LIMIT: "5" }),
    5
  );
});

test("resolveOptionalLimit rejects zero and non-numeric values", () => {
  assert.throws(
    () => resolveOptionalLimit("IMPORT_MATCH_LIMIT", { IMPORT_MATCH_LIMIT: "0" }),
    /IMPORT_MATCH_LIMIT/
  );
  assert.throws(
    () => resolveOptionalLimit("IMPORT_MATCH_LIMIT", { IMPORT_MATCH_LIMIT: "abc" }),
    /IMPORT_MATCH_LIMIT/
  );
});
