import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const reviewedHash = "6dab4d752dda9ce12dfc2dc504682cacfa192a53c6617a5dd919963e48e4014c";
export function validateAuthEmailSql(sql) {
  if (createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex") !== reviewedHash) throw new Error("Authentication migration changed; review its scope before changing the validator.");
  return sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
}

export function authEmailPlan({ authReady, tablePresent, schemaValid, recorded, conflictingHistory, historyComplete }) {
  if (!authReady || conflictingHistory || (tablePresent && !schemaValid) || (recorded && !tablePresent)) return { state: "blocked", message: "STOP: authentication prerequisites, rate-limit schema or migration history do not match. Inspect before applying SQL." };
  if (tablePresent) return { state: "ready", message: recorded ? "Authentication tables and recorded rate-limit migration are ready." : "Authentication rate-limit schema is ready, but 0003 is not recorded. Audit history before general migration commands; no SQL will be replayed." };
  return { state: "pending", recordMigration: historyComplete, message: "Schema-only 0003 is pending. It creates only the authentication rate-limit table and index; existing accounts, passwords, sessions and verification rows are untouched." };
}

const requiredColumns = {
  user: { id: "text", name: "text", email: "text", emailVerified: "bool", role: "text", createdAt: "date", updatedAt: "date" },
  account: { id: "text", userId: "text", accountId: "text", providerId: "text", password: "text", createdAt: "date", updatedAt: "date" },
  session: { id: "text", userId: "text", token: "text", expiresAt: "date", createdAt: "date", updatedAt: "date" },
  verification: { id: "text", identifier: "text", value: "text", expiresAt: "date", createdAt: "date", updatedAt: "date" },
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function inspectAuthEmail(client) {
  const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const entry = journal.entries.find((value) => value.tag === "0003_auth_rate_limits");
  if (!entry) throw new Error("Authentication migration is missing.");
  const sql = readFileSync(new URL("../drizzle/0003_auth_rate_limits.sql", import.meta.url), "utf8");
  validateAuthEmailSql(sql);
  const migration = { ...entry, sql, hash: hash(sql) };
  const { rows: columns } = await client.query("SELECT table_name,column_name,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name=ANY($2::text[])", ["public", [...Object.keys(requiredColumns), "rateLimit"]]);
  const authReady = Object.entries(requiredColumns).every(([table, fields]) => Object.entries(fields).every(([name, type]) => columns.some((column) => column.table_name === table && column.column_name === name && (type === "date" ? ["timestamp", "timestamptz"].includes(column.udt_name) : column.udt_name === type))));
  const added = columns.filter((column) => column.table_name === "rateLimit");
  const [{ tablePresent }] = (await client.query(`SELECT to_regclass('public."rateLimit"') IS NOT NULL AS "tablePresent"`)).rows;
  const { rows: indexes } = await client.query(`SELECT i.indisprimary,i.indisunique,i.indisvalid,pg_get_expr(i.indpred,i.indrelid) AS predicate,c.relname AS name,
    ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.num ORDER BY k.ord) AS columns
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname='rateLimit'`, ["public"]);
  const indexFor = (column, unique, primary = false) => indexes.some((index) => index.indisvalid && !index.predicate && index.indisunique === unique && index.indisprimary === primary && JSON.stringify(index.columns) === JSON.stringify([column]));
  const schemaValid = added.length === 4 && Object.entries({ id: "text", key: "text", count: "int4", lastRequest: "int8" }).every(([name, type]) => added.some((column) => column.column_name === name && column.udt_name === type && column.is_nullable === "NO" && !column.column_default)) && indexFor("id", true, true) && indexFor("key", true) && indexFor("lastRequest", false);
  const [{ present }] = (await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present")).rows;
  const records = present ? (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows : [];
  const recorded = records.some((record) => record.hash === migration.hash && String(record.created_at) === String(entry.when));
  const conflictingHistory = records.some((record) => String(record.created_at) === String(entry.when) && record.hash !== migration.hash);
  const previous = journal.entries.filter((value) => value.idx < entry.idx);
  const historyComplete = records.length === previous.length && previous.every((value) => {
    const prior = readFileSync(new URL(`../drizzle/${value.tag}.sql`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const acceptable = [hash(prior), hash(prior.replace(/\n/g, "\r\n"))];
    return records.some((record) => String(record.created_at) === String(value.when) && acceptable.includes(record.hash));
  });
  const state = { authReady, tablePresent, schemaValid, recorded, conflictingHistory, historyComplete };
  return { ...state, migration, plan: authEmailPlan(state) };
}
