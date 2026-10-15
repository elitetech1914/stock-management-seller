import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { validateAuthEmailSql } from "./auth-email-plan.mjs";

const require = createRequire(import.meta.url);
try {
  require.resolve("pg");
  for (const file of ["migrate-auth-email.mjs", "auth-email-plan.mjs", "auth-email-runner.mjs"]) await access(new URL(file, import.meta.url));
  const sql = await readFile(new URL("../drizzle/0003_auth_rate_limits.sql", import.meta.url), "utf8");
  validateAuthEmailSql(sql);
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  if (!journal.entries.some(entry => entry.tag === "0003_auth_rate_limits" && entry.idx === 3)) throw Error("Missing migration metadata");
  console.log("Authentication migration runtime files, reviewed SQL and production pg dependency are available. No database connection was made.");
} catch {
  console.error("Authentication migration runtime is incomplete. Preserve scripts/, drizzle/ and production pg in the application image.");
  process.exitCode = 2;
}
