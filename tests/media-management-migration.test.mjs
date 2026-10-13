import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { Client } from "pg";
import dotenv from "dotenv";
import { inspectMediaManagement, mediaManagementPlan, validateMediaManagementSql } from "../scripts/media-management-plan.mjs";
import { runMediaManagement } from "../scripts/media-management-runner.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sql = readFileSync(new URL("../drizzle/0002_media_management.sql", import.meta.url), "utf8");
const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
const migration = { ...journal.entries.find((entry) => entry.tag === "0002_media_management"), sql, hash: createHash("sha256").update(sql).digest("hex") };
const pending = { foundationReady: true, columnCount: 0, indexCount: 0, constraintCount: 0, recorded: false, historyComplete: true, conflictingHistory: false };
const ready = { ...pending, columnCount: 5, indexCount: 3, constraintCount: 2, recorded: true };
const status = (state) => ({ ...state, migration, plan: mediaManagementPlan(state) });

test("0002 is schema-only and rejects any modified SQL or partial/inconsistent schema", () => {
  assert.equal(validateMediaManagementSql(sql).length, 11);
  assert(!/\b(UPDATE|INSERT INTO|DELETE FROM|TRUNCATE|CREATE TABLE)\b/.test(sql.replaceAll("ON UPDATE no action", "")));
  assert.throws(() => validateMediaManagementSql(sql + "\nUPDATE product_images SET position=0;"));
  for (const change of [{ foundationReady: false }, { columnCount: 1 }, { indexCount: 1 }, { constraintCount: 1 }, { schemaValid: false }, { conflictingHistory: true }, { recorded: true }]) assert.equal(mediaManagementPlan({ ...pending, ...change }).state, "blocked");
  assert.equal(mediaManagementPlan(ready).state, "ready");
});

test("preview and readiness are read-only; only explicit apply executes 0002 and records it atomically", async () => {
  for (const [options, state, expected] of [[{},pending,0],[{check:true},pending,2],[{check:true},ready,0],[{apply:true},{...pending,foundationReady:false},2],[{apply:true},ready,0]]) {
    const queries = [];
    const code = await runMediaManagement({ query: async (query) => { queries.push(query); } }, { ...options, log: () => {}, inspect: async () => status(state) });
    assert.equal(code, expected); assert(queries.includes("ROLLBACK"));
    assert(!queries.some((query) => /^(DROP|ALTER|CREATE|INSERT)/.test(query)));
    if (!options.apply) assert.equal(queries[0], "BEGIN READ ONLY");
  }
  const queries = []; let count = 0;
  assert.equal(await runMediaManagement({ query: async (query) => { queries.push(query); } }, { apply:true,log:()=>{},inspect:async()=>status(count++ ? ready : pending) }), 0);
  assert.equal(queries.filter((query) => /^(DROP|ALTER|CREATE)/.test(query)).length, 11);
  assert.equal(queries.filter((query) => query.startsWith("INSERT INTO drizzle.__drizzle_migrations")).length, 1);
  assert.equal(queries.at(-1), "COMMIT");
  assert(!queries.some((query) => query.includes('CREATE TABLE "media_assets"')));
  const failed = [];
  await assert.rejects(runMediaManagement({ query: async (query) => { failed.push(query); if (query.startsWith('ALTER TABLE "product_images"')) throw new Error("write failed"); } }, {apply:true,log:()=>{},inspect:async()=>status(pending)}));
  assert.equal(failed.at(-1), "ROLLBACK"); assert(!failed.includes("COMMIT"));
});

test("real temporary tables preserve every existing image field; catalog checks verify apply, retry, drift and rollback", { skip: !process.env.DATABASE_URL, timeout:60000 }, async () => {
  const client = new Client({ connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000 });
  await client.connect();
  try {
    const publicCounts = async () => (await client.query("SELECT (SELECT count(*) FROM public.products) AS products,(SELECT count(*) FROM public.product_images) AS images,(SELECT count(*) FROM public.product_variants) AS variants")).rows[0];
    const before = await publicCounts();
    // Connection-local fixtures only. Never run a public migration or replay 0001.
    for (const table of ["products","product_images","product_variants"]) await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
    for (const table of ["categories","orders","order_items"]) await client.query(`CREATE TEMP TABLE ${table}(id uuid PRIMARY KEY)`);
    await client.query("CREATE TEMP TABLE import_batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(150) NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
    await client.query("CREATE TEMP TABLE media_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid NOT NULL,original_filename varchar(255) NOT NULL,object_key text NOT NULL UNIQUE,mime_type varchar(50) NOT NULL,size_bytes integer NOT NULL,width integer NOT NULL,height integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT media_assets_batch_id_import_batches_id_fk FOREIGN KEY(batch_id) REFERENCES import_batches(id) ON DELETE RESTRICT ON UPDATE NO ACTION)");
    await client.query("CREATE UNIQUE INDEX media_assets_batch_filename_idx ON media_assets(batch_id,original_filename)");
    await client.query("CREATE INDEX media_assets_batch_created_idx ON media_assets(batch_id,created_at,id)");
    await client.query("CREATE TEMP TABLE media_test_journal(hash text NOT NULL,created_at bigint NOT NULL)");
    for (const entry of journal.entries.filter((entry) => entry.idx < 2)) {
      const bytes = readFileSync(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url));
      await client.query("INSERT INTO media_test_journal VALUES($1,$2)",[createHash("sha256").update(bytes).digest("hex"),entry.when]);
    }
    const [{id:batch}] = (await client.query("INSERT INTO import_batches(name) VALUES('Fixture') RETURNING id")).rows;
    const [{id:asset}] = (await client.query("INSERT INTO media_assets(batch_id,original_filename,object_key,mime_type,size_bytes,width,height) VALUES($1,'Original.JPG','immutable/key.webp','image/webp',100,10,10) RETURNING id",[batch])).rows;
    const [{id:product}] = (await client.query("INSERT INTO products(title,slug,sku) VALUES('Legacy','legacy','LEGACY') RETURNING id")).rows;
    await client.query("INSERT INTO product_images(product_id,url,position,alt_text) VALUES($1,$2,3,'Custom alt'),($1,'https://external.invalid/image.jpg',8,NULL),($1,$2,8,'Duplicate retained')",[product,`/media/${asset}/original.webp`]);
    await client.query("INSERT INTO product_variants(product_id,sku,image_url) VALUES($1,'LEGACY-V',$2)",[product,`/media/${asset}/original.webp`]);
    const snapshot = async () => (await client.query("SELECT (SELECT jsonb_agg(to_jsonb(i)-'media_asset_id' ORDER BY position,id) FROM product_images i) AS images,(SELECT jsonb_agg(to_jsonb(v)-'media_asset_id' ORDER BY id) FROM product_variants v) AS variants,(SELECT jsonb_agg(to_jsonb(a)-'descriptive_name'-'deleted_at'-'storage_deleted_at' ORDER BY id) FROM media_assets a) AS assets")).rows[0];
    const original = await snapshot();
    const [{nspname:tempSchema}] = (await client.query("SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()")).rows;
    const calls = [];
    const isolated = { query: async (query, values) => {
      calls.push(query);
      let safe = query.replaceAll("'public.' || name", "'pg_temp.' || name").replaceAll("'drizzle.__drizzle_migrations'", "'pg_temp.media_test_journal'").replaceAll("drizzle.__drizzle_migrations", "media_test_journal")
        .replaceAll("table_schema='public'", "table_schema=$1").replaceAll("n.nspname='public'", "n.nspname=$1").replaceAll('"public".', 'pg_temp.');
      const result = await client.query(safe, safe.includes("=$1") && !values ? [tempSchema] : values);
      if (query.includes("AS target_schema")) for (const row of result.rows) if (row.target_schema === tempSchema) row.target_schema = "public";
      return result;
    } };
    const initial = await inspectMediaManagement(isolated);
    assert.equal(initial.plan.state,"pending",JSON.stringify({ ...initial, migration: undefined }));
    assert.equal(await runMediaManagement(isolated,{log:()=>{}}),0);
    assert.equal(await runMediaManagement(isolated,{check:true,log:()=>{}}),2);
    assert.deepEqual(await snapshot(),original);
    await client.query("CREATE INDEX product_images_media_asset_id_idx ON product_images(id)");
    assert.equal((await inspectMediaManagement(isolated)).plan.state,"blocked");
    await client.query("DROP INDEX product_images_media_asset_id_idx");
    // Failure after DDL verifies real rollback, including the migration record.
    let inspection = 0;
    await assert.rejects(runMediaManagement(isolated,{apply:true,log:()=>{},inspect:async(connection)=>{const inspected=await inspectMediaManagement(connection); if (++inspection===2) throw new Error("verification failed");return inspected;}}));
    assert.equal((await inspectMediaManagement(isolated)).plan.state,"pending"); assert.deepEqual(await snapshot(),original);
    assert.equal(await runMediaManagement(isolated,{apply:true,log:()=>{}}),0);
    assert.equal((await inspectMediaManagement(isolated)).plan.state,"ready");
    assert.deepEqual(await snapshot(),original);
    const appliedCalls = calls.length;
    assert.equal(await runMediaManagement(isolated,{apply:true,log:()=>{}}),0);
    assert(!calls.slice(appliedCalls).some((query)=>/^(DROP|ALTER|CREATE|INSERT)/.test(query)));
    assert.equal(await runMediaManagement(isolated,{check:true,log:()=>{}}),0);
    assert.equal((await client.query("SELECT count(*) FROM media_test_journal")).rows[0].count,"3");
    await client.query("ALTER TABLE media_assets ALTER COLUMN descriptive_name SET DEFAULT 'unexpected'");
    assert.equal((await inspectMediaManagement(isolated)).plan.state,"blocked");
    assert.deepEqual(await publicCounts(),before);
  } finally { await client.end(); }
});
