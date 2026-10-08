import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mediaMigrationPlan, validateMediaMigrationSql } from "../scripts/media-migration-plan.mjs";

const legacy = { commerceCount: 6, mediaCount: 0, recordCount: 0, baselineRecorded: false, mediaRecorded: false };
const sql = readFileSync(new URL("../drizzle/0001_media_upload_foundation.sql", import.meta.url), "utf8");

test("existing unjournaled commerce can add media without replaying or faking its baseline", () => {
  const plan = mediaMigrationPlan(legacy);
  assert.equal(plan.state, "pending");
  assert.equal(plan.recordMigration, false);
  assert.equal(mediaMigrationPlan({ ...legacy, mediaCount: 2 }).state, "ready");
});

test("journaled baseline can record the new media migration", () => {
  const plan = mediaMigrationPlan({ ...legacy, recordCount: 1, baselineRecorded: true });
  assert.equal(plan.state, "pending");
  assert.equal(plan.recordMigration, true);
  assert.equal(mediaMigrationPlan({ ...legacy, mediaCount: 2, recordCount: 2, baselineRecorded: true, mediaRecorded: true }).state, "ready");
});

test("partial or unexpected migration state blocks targeted migration", () => {
  for (const state of [
    { ...legacy, mediaCount: 1 },
    { ...legacy, commerceCount: 5 },
    { ...legacy, mediaRecorded: true },
    { ...legacy, recordCount: 1 },
    { ...legacy, recordCount: 2, baselineRecorded: true },
  ]) assert.equal(mediaMigrationPlan(state).state, "blocked");
  assert.equal(mediaMigrationPlan({ ...legacy, commerceCount: 0 }).state, "fresh");
});

test("targeted SQL is limited to the two media tables and their constraints/indexes", () => {
  assert.equal(validateMediaMigrationSql(sql).length, 5);
  assert.throws(() => validateMediaMigrationSql(`${sql}\nDROP TABLE products;`));
  assert.throws(() => validateMediaMigrationSql(sql.replace('CREATE TABLE "import_batches"', 'CREATE TABLE "products"')));
  assert.throws(() => validateMediaMigrationSql(sql.replace('CREATE INDEX "media_assets_batch_created_idx"', 'DROP INDEX "media_assets_batch_created_idx"')));
});
