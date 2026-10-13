# Media management: two-stage Coolify deployment

Base: confirmed deployed commit `c4af1d8c14a9b0079fb8d48eb3499592f0df1117` on `origin/main`. Production already has `0001_media_upload_foundation` applied and recorded. Never replay it.

## Stage 1: migration tooling

The `media-management-stage-1` tag identifies the tooling-only commit. Its application source and schema remain the deployed version. `0002` adds nullable columns, references and indexes only: it contains no row backfill, URL rewriting, position normalization or storage operations. Migration files and metadata must stay in the application runtime directory alongside `package.json` and the production `pg` dependency. Keep Railpack, `npm run build` and `npm run start` unchanged; this application does not use Next's standalone output.

Publish only this commit from your local checkout:

```sh
git push origin refs/tags/media-management-stage-1:refs/heads/main
```

Wait for Coolify's successful deployment and verify the deployed SHA equals the stage-1 tag. A Git push may trigger deployment; do not publish stage 2 yet. Inside the stage-1 application terminal:

```sh
npm run db:media-runtime
npm run db:media-management
```

The first command checks files/dependencies without connecting to the database. The second is a read-only preview. Stop on missing prerequisites, partial schemas or inconsistent history. The command never executes `0000` or `0001`, invokes Drizzle Kit, or changes the legacy baseline.

Take and verify a database backup before applying the reviewed pending migration. Then, manually in that same application terminal:

```sh
npm run db:media-management -- --apply
npm run db:media-management -- --check
```

`--apply` runs only reviewed `0002` in one transaction, records it when the existing history is complete, and verifies schema before committing. `--check` is read-only and returns success only when ready. A successful re-run does not replay DDL. Compare existing gallery IDs, URLs, positions/order, primary selections and alt text before and after; none should change. Keep a record of the backup and command output.

## Stage 2: application features

Only after stage 1 and the readiness/data checks pass, the `media-management-stage-2` tag can be published:

```sh
git push origin refs/tags/media-management-stage-2:refs/heads/main
```

Both pushes are normal fast-forward updates. If either is rejected, stop and inspect the remote; never force-push or rewrite history. Stage 2 enables search, rename and guarded deletion. Legacy images display immediately, including images without explicit asset references. Ordinary product saves establish verified references while retaining the existing gallery. No bulk data backfill runs at build, startup, migration or page render.

Existing relative `/media/<UUID>/...` links and absolute links on `BETTER_AUTH_URL` are recognized for search and deletion protection. External URLs remain external. Supported legacy links need no backfill. Any unsupported references require a separate reviewed mapping; an optional future association-only operation must preview changes and modify only verified `media_asset_id` fields, preserving URLs, positions and alt text. No such production operation is run as part of either release.

## Verification and recovery

Verify both commits independently: focused tests, lint, TypeScript, migration snapshots and production builds. Schema write tests use connection-local temporary tables only. Confirm stage-1 migration files and `pg` remain available with production dependencies. After deployment, check existing storefront images and admin pages before trying mutations on dedicated test assets.

If stage 1 fails, leave stage 2 unpublished. If application rollback is needed, use the previous Coolify application image and retain the added schema. Do not drop columns, restore production data over newer writes, or undo migration history automatically. Existing application code tolerates the nullable additions. Explicit file deletions made later through stage 2 are irreversible storage operations and cannot be undone by an application rollback.
