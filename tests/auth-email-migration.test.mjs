import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import dotenv from "dotenv";
import { authEmailPlan, inspectAuthEmail, validateAuthEmailSql } from "../scripts/auth-email-plan.mjs";
import { runAuthEmailMigration } from "../scripts/auth-email-runner.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sql = readFileSync(new URL("../drizzle/0003_auth_rate_limits.sql", import.meta.url), "utf8");
const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
const entry = journal.entries.find((value) => value.tag === "0003_auth_rate_limits");
const pending = { authReady: true, tablePresent: false, schemaValid: false, recorded: false, conflictingHistory: false, historyComplete: true };
const ready = { ...pending, tablePresent: true, schemaValid: true, recorded: true };
const status = (state) => ({ ...state, migration: { sql, hash: createHash("sha256").update(sql).digest("hex"), when: entry.when }, plan: authEmailPlan(state) });

test("reviewed authentication migration is schema-only; drift and missing prerequisites block it", () => {
  assert.equal(validateAuthEmailSql(sql).length, 2);
  assert.throws(() => validateAuthEmailSql(sql + '\nUPDATE "user" SET "emailVerified"=true;'));
  assert.equal(authEmailPlan(pending).state, "pending");
  assert.equal(authEmailPlan(ready).state, "ready");
  for (const override of [{ authReady: false }, { conflictingHistory: true }, { recorded: true }, { tablePresent: true }]) assert.equal(authEmailPlan({ ...pending, ...override }).state, "blocked");
});

test("preview/check do not write; explicit apply records only 0003 and rolls back failure", async () => {
  for (const [options, state, code] of [[{}, pending, 0], [{ check: true }, pending, 2], [{ check: true }, ready, 0], [{ apply: true }, ready, 0], [{ apply: true }, { ...pending, authReady: false }, 2]]) {
    const calls = [];
    assert.equal(await runAuthEmailMigration({ query: async (query) => calls.push(query) }, { ...options, inspect: async () => status(state), log() {} }), code);
    assert(!calls.some((query) => /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)/.test(query)));
    if (!options.apply) assert.equal(calls[0], "BEGIN READ ONLY");
  }
  const calls = []; let count = 0;
  assert.equal(await runAuthEmailMigration({ query: async (query) => calls.push(query) }, { apply: true, inspect: async () => status(count++ ? ready : pending), log() {} }), 0);
  assert.equal(calls.filter((query) => query.startsWith("CREATE")).length, 2);
  assert.equal(calls.filter((query) => query.startsWith("INSERT")).length, 1);
  assert.equal(calls.at(-1), "COMMIT");
  const failed = [];
  await assert.rejects(runAuthEmailMigration({ query: async (query) => { failed.push(query); if (query.startsWith("CREATE INDEX")) throw Error("Fixture failure"); } }, { apply: true, inspect: async () => status(pending), log() {} }));
  assert.equal(failed.at(-1), "ROLLBACK");
});

test("real temporary tables preserve accounts/passwords/roles/sessions while checking apply and rollback", { skip: !process.env.DATABASE_URL, timeout: 30000 }, async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const publicCounts = async () => (await client.query('SELECT (SELECT count(*) FROM public."user") AS users,(SELECT count(*) FROM public.account) AS accounts,(SELECT count(*) FROM public.session) AS sessions,(SELECT count(*) FROM public.verification) AS verifications')).rows;
    const before = await publicCounts();
    for (const table of ["user", "account", "session", "verification"]) await client.query(`CREATE TEMP TABLE "${table}" (LIKE public."${table}" INCLUDING ALL)`);
    await client.query(`INSERT INTO "user"(id,name,email,"emailVerified",role,"createdAt","updatedAt") VALUES('legacy','Legacy','legacy@example.invalid',false,'admin',now(),now())`);
    await client.query(`INSERT INTO account(id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES('credential','legacy','legacy','credential','unchanged-password-hash',now(),now())`);
    await client.query(`INSERT INTO session(id,"userId",token,"expiresAt","createdAt","updatedAt") VALUES('session','legacy','existing-session',now()+interval '1 day',now(),now())`);
    await client.query(`INSERT INTO verification(id,identifier,value,"expiresAt","createdAt","updatedAt") VALUES('verification','existing-token','legacy',now()+interval '1 day',now(),now())`);
    const snapshot = async () => (await client.query('SELECT (SELECT jsonb_agg(to_jsonb(t)) FROM "user" t) AS users,(SELECT jsonb_agg(to_jsonb(t)) FROM account t) AS accounts,(SELECT jsonb_agg(to_jsonb(t)) FROM session t) AS sessions,(SELECT jsonb_agg(to_jsonb(t)) FROM verification t) AS verifications')).rows;
    const original = await snapshot();
    await client.query("CREATE TEMP TABLE auth_fixture_journal(hash text NOT NULL,created_at bigint NOT NULL)");
    for (const prior of journal.entries.filter((value) => value.idx < entry.idx)) await client.query("INSERT INTO auth_fixture_journal VALUES($1,$2)", [createHash("sha256").update(readFileSync(new URL(`../drizzle/${prior.tag}.sql`, import.meta.url))).digest("hex"), prior.when]);
    const [{ nspname }] = (await client.query("SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()")).rows;
    const isolated = { query: async (query, values) => {
      const safe = query.replaceAll("SET LOCAL search_path = public", "SET LOCAL search_path = pg_temp").replaceAll(`public."rateLimit"`, `pg_temp."rateLimit"`).replaceAll("drizzle.__drizzle_migrations", "pg_temp.auth_fixture_journal").replace('CREATE TABLE "rateLimit"', 'CREATE TEMP TABLE "rateLimit"');
      return client.query(safe, values?.map((value) => value === "public" ? nspname : value));
    } };
    assert.equal((await inspectAuthEmail(isolated)).plan.state, "pending");
    assert.equal(await runAuthEmailMigration(isolated, { log() {} }), 0);
    assert.deepEqual(await snapshot(), original);
    let inspection = 0;
    await assert.rejects(runAuthEmailMigration(isolated, { apply: true, log() {}, inspect: async (connection) => { const state = await inspectAuthEmail(connection); if (++inspection === 2) throw Error("Fixture post-DDL failure"); return state; } }));
    assert.equal((await inspectAuthEmail(isolated)).plan.state, "pending");
    assert.equal(await runAuthEmailMigration(isolated, { apply: true, log() {} }), 0);
    assert.equal(await runAuthEmailMigration(isolated, { apply: true, log() {} }), 0);
    assert.equal(await runAuthEmailMigration(isolated, { check: true, log() {} }), 0);
    assert.deepEqual(await snapshot(), original);
    await client.query('ALTER TABLE "rateLimit" ALTER COLUMN count DROP NOT NULL');
    assert.equal((await inspectAuthEmail(isolated)).plan.state, "blocked");
    assert.deepEqual(await publicCounts(), before);
  } finally { await client.end(); }
});
