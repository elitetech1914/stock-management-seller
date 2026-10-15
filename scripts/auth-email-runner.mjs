import { inspectAuthEmail, validateAuthEmailSql } from "./auth-email-plan.mjs";

export async function runAuthEmailMigration(client, { apply = false, check = false, log = console.log, inspect = inspectAuthEmail } = {}) {
  if (apply && check) throw new Error("Choose either --apply or --check.");
  await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL search_path = public");
    if (apply) await client.query("SELECT pg_advisory_xact_lock(hashtext('auth-email-rate-limit-migration'))");
    const status = await inspect(client);
    log(status.plan.message);
    if (!apply || status.plan.state !== "pending") {
      if (status.plan.state === "pending") log("Preview only. After backup and review: npm run db:auth-email -- --apply. This never applies earlier migrations.");
      await client.query("ROLLBACK");
      return status.plan.state === "blocked" || (check && status.plan.state !== "ready") ? 2 : 0;
    }
    for (const statement of validateAuthEmailSql(status.migration.sql)) await client.query(statement);
    if (status.plan.recordMigration) await client.query("INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)", [status.migration.hash, status.migration.when]);
    const after = await inspect(client);
    if (after.plan.state !== "ready" || (status.plan.recordMigration && !after.recorded)) throw new Error("Authentication schema verification failed.");
    await client.query("COMMIT");
    log("Schema-only 0003 applied; existing authentication and application records were not changed.");
    if (!status.plan.recordMigration) log("Incomplete prior migration history was left unchanged. Audit it separately before any general db:migrate command.");
    return 0;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
}
