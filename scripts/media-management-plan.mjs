import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inspectMediaMigration } from "./media-migration-plan.mjs";

// Reviewed schema-only SQL. Normalize checkout line endings for scope checking;
// Drizzle's migration record still hashes the exact deployed bytes.
const reviewedHash = "b152300559bd33e31d49058e23029b317b0cce455460020613d92c70dc7b5deb";
export function validateMediaManagementSql(sql) {
  if (createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex") !== reviewedHash) throw new Error("Media management SQL changed. Review its scope before updating the migration validator.");
  return sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
}

export function mediaManagementPlan({ foundationReady, columnCount, indexCount, constraintCount, recorded, historyComplete, conflictingHistory, schemaValid = true }) {
  if (!foundationReady) return { state: "blocked", message: "STOP: the existing, recorded 0001 media foundation is required. This command never applies or replays 0001. Verify the target database and migration history." };
  if (conflictingHistory || !schemaValid) return { state: "blocked", message: "STOP: schema definitions or recorded migration history do not match the reviewed migration. Inspect before applying SQL." };
  if (columnCount === 5 && indexCount === 3 && constraintCount === 2) return { state: "ready", message: recorded ? "Media management schema and migration record are ready." : "Media management schema is ready, but 0002 is not recorded. Audit history before using general db:migrate; no SQL will be replayed." };
  if (columnCount === 0 && indexCount === 0 && constraintCount === 0 && !recorded) return { state: "pending", recordMigration: historyComplete, message: "Schema-only media management migration 0002 is pending. Existing gallery rows, URLs, positions, primary selections, alt text and storage objects will remain unchanged." };
  return { state: "blocked", message: "STOP: partial media management schema or inconsistent history. Inspect before applying SQL." };
}

const foundationColumns = [
  ["import_batches", "id", "uuid", null, "NO"], ["import_batches", "name", "varchar", 150, "NO"], ["import_batches", "created_at", "timestamptz", null, "NO"],
  ["media_assets", "id", "uuid", null, "NO"], ["media_assets", "batch_id", "uuid", null, "NO"], ["media_assets", "original_filename", "varchar", 255, "NO"],
  ["media_assets", "object_key", "text", null, "NO"], ["media_assets", "mime_type", "varchar", 50, "NO"], ["media_assets", "size_bytes", "int4", null, "NO"],
  ["media_assets", "width", "int4", null, "NO"], ["media_assets", "height", "int4", null, "NO"], ["media_assets", "created_at", "timestamptz", null, "NO"],
  ["product_images", "id", "uuid", null, "NO"], ["product_images", "product_id", "uuid", null, "NO"], ["product_images", "url", "text", null, "NO"],
  ["product_images", "position", "int4", null, "NO"], ["product_images", "alt_text", "varchar", 255, "YES"],
  ["product_variants", "id", "uuid", null, "NO"], ["product_variants", "product_id", "uuid", null, "NO"], ["product_variants", "image_url", "text", null, "YES"],
];
const managementColumns = [
  ["media_assets", "descriptive_name", "varchar", 255, "YES"], ["media_assets", "deleted_at", "timestamptz", null, "YES"], ["media_assets", "storage_deleted_at", "timestamptz", null, "YES"],
  ["product_images", "media_asset_id", "uuid", null, "YES"], ["product_variants", "media_asset_id", "uuid", null, "YES"],
];
const sameColumns = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
function validIndex(index, table, columns, unique) {
  return Boolean(index && index.table_name === table && index.indisvalid && index.indisunique === unique && sameColumns(index.columns, columns));
}
function validReference(reference, table, column, target) {
  return Boolean(reference && reference.table_name === table && reference.target_schema === "public" && reference.target_table === target && reference.confdeltype === "r" && reference.confupdtype === "a" && reference.convalidated && sameColumns(reference.columns, [column]) && sameColumns(reference.target_columns, ["id"]));
}

export async function inspectMediaManagement(client) {
  const foundation = await inspectMediaMigration(client);
  const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const entry = journal.entries.find((value) => value.tag === "0002_media_management");
  if (!entry) throw new Error("Management migration is missing.");
  const sql = readFileSync(new URL("../drizzle/0002_media_management.sql", import.meta.url), "utf8");
  validateMediaManagementSql(sql);
  const migration = { ...entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
  const { rows: columns } = await client.query(String.raw`SELECT table_name,column_name,udt_name,character_maximum_length,is_nullable,column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('import_batches','media_assets','product_images','product_variants')`);
  const matchesColumn = ([table, name, type, length, nullable]) => columns.some((column) => column.table_name === table && column.column_name === name && column.udt_name === type && column.character_maximum_length === length && column.is_nullable === nullable);
  const addedColumns = managementColumns.map(([table, name]) => columns.find((column) => column.table_name === table && column.column_name === name)).filter(Boolean);
  const { rows: indexes } = await client.query(`SELECT c.relname AS name,t.relname AS table_name,i.indisunique,i.indisvalid,pg_get_expr(i.indpred,i.indrelid) AS predicate,
    ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.num ORDER BY k.ord) AS columns
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('media_assets_batch_filename_idx','media_assets_batch_created_idx','product_images_media_asset_id_idx','product_variants_media_asset_id_idx')`);
  const { rows: references } = await client.query(`SELECT c.conname AS name,t.relname AS table_name,f.relname AS target_table,fn.nspname AS target_schema,c.confdeltype,c.confupdtype,c.convalidated,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS target_columns
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class f ON f.oid=c.confrelid JOIN pg_namespace fn ON fn.oid=f.relnamespace
    WHERE n.nspname='public' AND c.conname IN ('media_assets_batch_id_import_batches_id_fk','product_images_media_asset_id_media_assets_id_fk','product_variants_media_asset_id_media_assets_id_fk')`);
  const filenameIndex = indexes.find((index) => index.name === "media_assets_batch_filename_idx");
  const createdIndex = indexes.find((index) => index.name === "media_assets_batch_created_idx");
  const pendingPredicate = filenameIndex?.predicate === null;
  const readyPredicate = filenameIndex?.predicate?.replace(/[()\s]/g, "") === "storage_deleted_atISNULL";
  const newIndexes = indexes.filter((index) => index.name.startsWith("product_"));
  const newReferences = references.filter((reference) => reference.name.startsWith("product_"));
  const foundationReady = foundation.plan.state === "ready" && foundation.mediaRecorded && foundationColumns.every(matchesColumn)
    && validIndex(filenameIndex, "media_assets", ["batch_id", "original_filename"], true) && (pendingPredicate || readyPredicate)
    && validIndex(createdIndex, "media_assets", ["batch_id", "created_at", "id"], false) && !createdIndex.predicate
    && validReference(references.find((reference) => reference.name === "media_assets_batch_id_import_batches_id_fk"), "media_assets", "batch_id", "import_batches");
  const schemaValid = addedColumns.every((column) => !column.column_default) && (addedColumns.length === 0 || managementColumns.every(matchesColumn))
    && newIndexes.every((index) => validIndex(index, index.name === "product_images_media_asset_id_idx" ? "product_images" : "product_variants", ["media_asset_id"], false) && !index.predicate)
    && newReferences.every((reference) => validReference(reference, reference.name === "product_images_media_asset_id_media_assets_id_fk" ? "product_images" : "product_variants", "media_asset_id", "media_assets"));
  const [{ present }] = (await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present")).rows;
  const records = present ? (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows : [];
  const recorded = records.some((record) => record.hash === migration.hash && String(record.created_at) === String(entry.when));
  const conflictingHistory = records.some((record) => String(record.created_at) === String(entry.when) && record.hash !== migration.hash) || records.some((record) => Number(record.created_at) > entry.when);
  const state = { foundationReady, columnCount: addedColumns.length, indexCount: newIndexes.length + (readyPredicate ? 1 : 0), constraintCount: newReferences.length, recorded, conflictingHistory, schemaValid,
    historyComplete: foundation.baselineRecorded && foundation.mediaRecorded && records.length === 2 };
  return { ...state, migration, plan: mediaManagementPlan(state) };
}
