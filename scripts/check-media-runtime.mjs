// Packaging check only: no database connection and no migration execution.
import { readFileSync, accessSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateMediaManagementSql } from "./media-management-plan.mjs";

for (const relative of ["./migrate-media-management.mjs", "./media-management-runner.mjs", "./media-management-plan.mjs", "./media-migration-plan.mjs", "../drizzle/0000_lyrical_wolf_cub.sql", "../drizzle/0001_media_upload_foundation.sql", "../drizzle/0002_media_management.sql", "../drizzle/meta/_journal.json"]) accessSync(fileURLToPath(new URL(relative, import.meta.url)));
const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
for (const tag of ["0000_lyrical_wolf_cub", "0001_media_upload_foundation", "0002_media_management"]) if (!journal.entries.some((entry) => entry.tag === tag)) throw new Error("Required migration metadata is missing.");
validateMediaManagementSql(readFileSync(new URL("../drizzle/0002_media_management.sql", import.meta.url), "utf8"));
await import("pg");
console.log("Media migration files and runtime PostgreSQL dependency are present. No database connection or migration was run.");
