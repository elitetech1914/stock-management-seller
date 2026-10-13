import pg from "pg";
import { runMediaManagement } from "./media-management-runner.mjs";

if (!process.env.DATABASE_URL) {
  try { (await import("dotenv")).config({ quiet: true }); } catch { /* Runtime variables. */ }
}
const args = process.argv.slice(2);
if (args.some((arg) => !["--apply", "--check"].includes(arg)) || (args.includes("--apply") && args.includes("--check")) || !process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Usage: npm run db:media-management [-- --apply | -- --check]. Default: read-only preview. --check succeeds only when ready."); process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  process.exitCode = await runMediaManagement(client, { apply: args.includes("--apply"), check: args.includes("--check") });
} catch (error) {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{3,30}$/.test(error.code) ? " (" + error.code + ")" : "";
  console.error("Media management check/migration failed" + code + ". Inspect database status; no partial migration is committed."); process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
