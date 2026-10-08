import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function mediaMigrationPlan({ commerceCount, mediaCount, recordCount, baselineRecorded, mediaRecorded }) {
  if (commerceCount === 0 && mediaCount === 0 && recordCount === 0) {
    return { state: "fresh", message: "Fresh database: use npm run db:migrate to initialize commerce and media tables." };
  }
  if (commerceCount !== 6 || mediaCount === 1 || (mediaCount === 0 && mediaRecorded)) {
    return { state: "blocked", message: "STOP: partial tables or inconsistent migration history. Inspect the database before applying any migration." };
  }
  if (mediaCount === 2) {
    if (baselineRecorded && mediaRecorded) {
      return { state: "ready", message: "Both media tables exist and the media migration is recorded." };
    }
    if (recordCount === 0 || (baselineRecorded && recordCount === 1)) {
      return { state: "ready", message: "Both media tables exist. Migration history is incomplete: audit the baseline before using general db:migrate commands." };
    }
  }
  if (mediaCount === 0 && baselineRecorded && recordCount === 1) {
    return { state: "pending", recordMigration: true, message: "Media tables are missing. The initial migration is recorded. The targeted media migration can be applied." };
  }
  if (mediaCount === 0 && recordCount === 0) {
    return { state: "pending", recordMigration: false, message: "Media tables are missing. Commerce tables exist without recorded migrations. Apply only the media migration; leave the legacy baseline unchanged." };
  }
  return { state: "blocked", message: "STOP: unexpected migration history. Inspect it before applying any migration." };
}

export function validateMediaMigrationSql(sql) {
  const statements = sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
  const expected = [
    /^CREATE TABLE "import_batches" \([\s\S]*\);$/,
    /^CREATE TABLE "media_assets" \([\s\S]*\);$/,
    /^ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_batch_id_import_batches_id_fk" FOREIGN KEY \("batch_id"\) REFERENCES "public"\."import_batches"\("id"\) ON DELETE restrict ON UPDATE no action;$/,
    /^CREATE UNIQUE INDEX "media_assets_batch_filename_idx" ON "media_assets" USING btree \("batch_id","original_filename"\);$/,
    /^CREATE INDEX "media_assets_batch_created_idx" ON "media_assets" USING btree \("batch_id","created_at","id"\);$/,
  ];
  if (statements.length !== expected.length || statements.some((statement, index) =>
    !expected[index].test(statement) || (statement.match(/;/g) ?? []).length !== 1)) {
    throw new Error("Media migration SQL has changed outside the expected additive scope. Review the migration before continuing.");
  }
  return statements;
}

export async function inspectMediaMigration(client) {
  const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const loadMigration = (tag) => {
    const entry = journal.entries.find((value) => value.tag === tag);
    if (!entry) throw new Error("Expected migration is missing from the journal.");
    const sql = readFileSync(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8");
    return { ...entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
  };
  const baseline = loadMigration("0000_lyrical_wolf_cub");
  const migration = loadMigration("0001_media_upload_foundation");
  const names = ["categories", "products", "product_images", "product_variants", "orders", "order_items", "import_batches", "media_assets"];
  const { rows: tables } = await client.query("SELECT name, to_regclass('public.' || name) IS NOT NULL AS present FROM unnest($1::text[]) AS name", [names]);
  const present = new Set(tables.filter((table) => table.present).map((table) => table.name));
  const commerceCount = names.slice(0, 6).filter((name) => present.has(name)).length;
  const mediaCount = names.slice(6).filter((name) => present.has(name)).length;
  const { rows: [journalTable] } = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present");
  const records = journalTable.present ? (await client.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows : [];
  const recorded = (entry) => records.some((record) => record.hash === entry.hash && String(record.created_at) === String(entry.when));
  const state = { commerceCount, mediaCount, recordCount: records.length, baselineRecorded: recorded(baseline), mediaRecorded: recorded(migration) };
  return { ...state, migration, plan: mediaMigrationPlan(state) };
}

export function printMediaMigrationStatus(status) {
  console.log(`Commerce tables: ${status.commerceCount}/6; media tables: ${status.mediaCount}/2; migration records: ${status.recordCount}.`);
  console.log(status.plan.message);
}
