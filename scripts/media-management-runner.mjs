import { inspectMediaManagement, validateMediaManagementSql } from "./media-management-plan.mjs";

export async function runMediaManagement(client, { apply = false, check = false, log = console.log, inspect = inspectMediaManagement } = {}) {
  if (apply && check) throw new Error("Choose either --apply or --check.");
  await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL search_path = public");
    if (apply) await client.query("SELECT pg_advisory_xact_lock(hashtext('media-upload-foundation-migration'))");
    const status = await inspect(client);
    log(status.plan.message);
    if (!apply || status.plan.state !== "pending") {
      if (status.plan.state === "pending") log("Preview only: 0002 adds schema and does not modify gallery data. After a backup and review, use npm run db:media-management -- --apply.");
      await client.query("ROLLBACK");
      return status.plan.state === "blocked" || (check && status.plan.state !== "ready") ? 2 : 0;
    }
    for (const statement of validateMediaManagementSql(status.migration.sql)) await client.query(statement);
    if (status.plan.recordMigration) await client.query("INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)", [status.migration.hash, status.migration.when]);
    const after = await inspect(client);
    if (after.plan.state !== "ready" || (status.plan.recordMigration && !after.recorded)) throw new Error("Management schema verification failed.");
    await client.query("COMMIT");
    log("Schema-only 0002 applied. Existing gallery data and storage objects were not changed.");
    if (!status.plan.recordMigration) log("Existing migration history was left unchanged. Audit it before using general db:migrate commands.");
    return 0;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
}
