import pg from "pg";
import { runAuthEmailMigration } from "./auth-email-runner.mjs";

if (!process.env.DATABASE_URL) {
  try { (await import("dotenv")).config({ quiet: true }); } catch { /* Runtime environment. */ }
}
const args = process.argv.slice(2);
if (args.some((arg) => !["--apply", "--check"].includes(arg)) || (args.includes("--apply") && args.includes("--check")) || !process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Usage: npm run db:auth-email [-- --apply | -- --check]. Default is read-only; --check succeeds only when ready."); process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  process.exitCode = await runAuthEmailMigration(client, { apply: args.includes("--apply"), check: args.includes("--check") });
} catch (error) {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{3,30}$/.test(error.code) ? " (" + error.code + ")" : "";
  console.error("Authentication migration check failed" + code + ". No partial migration was committed; inspect prerequisites and schema."); process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
