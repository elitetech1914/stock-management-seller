# Account recovery and optional email verification

Deploy this work in two stages. No push, deployment, production migration, domain-setting change or live email test has been performed. Existing accounts, password hashes and roles are preserved. Email verification stays optional, including after smoke tests.

Review base: `570c794404d31f778f5a7d8f22602bd7062534cc`. The current workspace contains both stages together. `auth-email-stage-1.patch` applies to that base; `auth-email-stage-2.patch` applies on top of stage 1. The patch artifacts are for review/preparing release commits and are not themselves part of the application patch. Do not deploy the combined workspace as stage 1.

To prepare the first release locally from this repository directory, after reviewing its patch:

```sh
git worktree add -b release/auth-email-schema ../apex-auth-email-schema 570c794404d31f778f5a7d8f22602bd7062534cc
git -C ../apex-auth-email-schema apply --check ../stockmora/docs/auth-email-stage-1.patch
git -C ../apex-auth-email-schema apply ../stockmora/docs/auth-email-stage-1.patch
```

Review, verify and commit that separate worktree. No commits/tags have been created by this task. Publish only its schema-stage commit after explicit deployment authorization. For stage 2, use a separate clean checkout of that schema-stage commit and apply/check `auth-email-stage-2.patch`; review/commit it separately and withhold publication until the schema and deployment prerequisites below pass. Never force-push if publication is rejected.

## Stage 1 — additive schema and manual tooling

`auth-email-stage-1.patch` is a reviewable patch against the base commit recorded below. It contains only:

- `drizzle/0003_auth_rate_limits.sql`, the new snapshot and appended journal entry.
- The Drizzle `rateLimit` declaration and table filter.
- `scripts/auth-email-plan.mjs`, `auth-email-runner.mjs`, `migrate-auth-email.mjs`, `check-auth-email-runtime.mjs`.
- Temporary-table migration tests and their npm commands.

Better Auth remains at the previously installed 1.7.5 version, with unchanged authentication configuration and UI. There is no update, backfill or deletion of existing auth or application records. `0003` creates only `public."rateLimit"` and its timestamp index: text primary key, unique text request key, integer count, bigint last-request time.

The patch is intended for a clean checkout of the base commit, **not** the current combined working tree. Review and commit the schema stage separately. Publish only that reviewed commit; a push may trigger Coolify. Do not publish the application stage yet. Keep Railpack's existing `npm run build` / `npm run start` behavior. Preserve `scripts/`, `drizzle/`, `package.json` and production `pg` in the runtime image; this project does not use standalone output.

In the deployed stage-1 application terminal, run only these read-only prerequisites:

```sh
npm run db:auth-email-runtime
npm run db:auth-email
```

The runtime command does not connect to PostgreSQL. The preview checks existing auth columns, limiter columns and constraints, and migration history without writing. Stop on missing prerequisites or schema/history conflicts. A pending table is expected before the manual migration.

Take a PostgreSQL backup, verify that it can be restored, and record the currently successful Coolify application SHA/image. Retain a private before/after comparison of existing auth IDs, password hashes, roles and verification state; do not paste hashes or credentials into logs/issues. Product galleries and Garage are outside this migration.

After separately approving the preview and backup, run manually:

```sh
npm run db:auth-email -- --apply
npm run db:auth-email -- --check
```

`--apply` executes only the hash-reviewed `0003` statements in one transaction under an advisory lock. It verifies the resulting schema before committing and does not replay `0000`, `0001` or `0002`. Production's already-recorded `0001` is retained. When the entire prior Drizzle history matches, the runner records only `0003`. If the old history is incomplete, it leaves that history unchanged and explicitly reports the unrecorded addition; a valid existing table is never recreated. Audit incomplete history separately before using any general migration command. `--check` is read-only; exit 0 means the auth prerequisites and limiter schema are ready, exit 2 means pending/blocked.

Do **not** use `npm run auth:migrate`, `db:migrate`, `db:push`, or Better Auth's broad migration suggestion for this release. Those commands are not scoped to this change.

## Stage 2 — application

Deploy only after stage 1's readiness check and before/after data comparison pass. The application stage pins Better Auth **1.7.8**, retains its PostgreSQL adapter/default password hashing and cookies, and enables database throttling. There is no memory fallback if the table is missing.

Runtime configuration:

- Keep `BETTER_AUTH_SECRET` unchanged; rotating it would invalidate existing sessions.
- `BETTER_AUTH_URL` must have production origin `https://www.apextradealliance.com`. Localhost development still works.
- Existing runtime-only `RESEND_API_KEY` and `EMAIL_FROM` are read at send time. Do not expose them as `NEXT_PUBLIC_*` or add them to build variables. Sender: `Apex Trade Alliance <no-reply@apextradealliance.com>`.

Before any live email request, manually confirm the verified Resend domain has **click tracking disabled**. Its current setting is unknown. Do not change it automatically. Resend can rewrite links when tracking is enabled; this application preserves Better Auth's generated URLs and supplies HTML/plain text without a tracking override. See [Resend tracking documentation](https://resend.com/docs/dashboard/domains/tracking).

Before enabling the application, verify Coolify's trusted proxy overwrites/cleans `X-Forwarded-For` with a reliable connecting-client address, rather than trusting a client-supplied first entry. Better Auth 1.7.8 uses that header by default. Restrict direct access to the application port to the proxy. Confirm distinct clients resolve to distinct limiter keys and spoofed incoming forwarding headers cannot bypass the limit. No Coolify proxy configuration was available locally, so this remains a required operator check.

Recovery and public verification resend use 3 requests/minute/IP; reset completion uses 10/minute/IP; password changes use 5/minute/IP. Better Auth's existing sign-in limits remain. Delivery runs through Next.js `after()` with three attempts, five-second request timeouts, bounded delays and the same hashed idempotency key on retries. Provider failure or missing email configuration is logged without recipient, credentials, passwords or token URLs and does not expose account existence through the response or provider latency.

New passwords require 15–128 characters. Existing short-password logins continue working. Buyers are still automatically signed in after registering. New registrations receive a 24-hour verification link, but verification is optional. Existing unverified buyers/admins remain able to log in, and login does not send them verification email automatically. Verification never automatically creates a session.

## Authorized production smoke tests

Perform these manually only after an explicitly authorized deployment and the domain/proxy checks, using dedicated controlled test accounts and inboxes:

1. Confirm existing buyer/admin sign-in and roles, including an existing short password. Confirm anonymous and buyer access to admin security is denied.
2. Request recovery from buyer and admin login. Compare the confirmation for known/unknown addresses; check HTML and text delivery and spam folders. Inspect the received link destination before clicking: canonical HTTPS origin, original token/callback, no click-tracking redirect.
3. Reset using matching 15–128-character fields. Confirm token URL is replaced by the appropriate login success page, no automatic sign-in occurs, old password fails and sessions on all devices are invalidated. Reuse/invalid/expired links must fail safely. Avoid sharing token-bearing screenshots/URLs.
4. Change password on each protected security page, requiring the existing password. Default revoke-other-sessions should preserve the current login and invalidate other devices. Unchecking it should retain those sessions. Confirm sign-out and failure feedback.
5. Register a buyer and confirm automatic sign-in and optional verification reminder. Check the 24-hour email, success/failure routes, public resend, and harmless verification replay without automatic sign-in. Confirm existing unverified accounts still have access.
6. Check throttling/retry guidance without burdening real users, including distinct real IPs and forwarded-header spoof attempts. Confirm no secrets or token-bearing URLs enter application delivery logs.

Keep mandatory verification disabled. Enforcement requires a separately reviewed rollout even if these delivery tests pass.

## Rollback

If the schema stage fails, leave the application stage unpublished. The SQL transaction rolls back failure without touching auth data. If the application stage fails, redeploy the successful schema-stage image/commit (or prior application image) and **leave the additive limiter table and journal entry intact**. Do not drop it, rotate the auth secret, run a blanket auth migration or restore an old database over newer user activity. Password/verification changes legitimately made after deployment remain; an application rollback does not undo them. Fix runtime configuration and retry delivery through the public forms after recovery; queued jobs are process-local, not a durable mail queue.

## Local verification

```sh
npm run test:auth-email
npm run db:check
node node_modules/typescript/bin/tsc --noEmit
```

`test:auth-email` uses temporary migration tables and a disposable uniquely named auth schema, never production account rows. Auth integration tests require `AUTH_TEST_DATABASE_URL`, or the existing local `DATABASE_URL` only when `BETTER_AUTH_URL` is localhost. Missing database configuration is reported as a skip. Resend is mocked; no emails are sent. Disposable schemas are dropped in `finally`. Both release stages must pass their own focused lint, TypeScript and production build checks.

Browser checks cover 320/375/768/1024/1440px forms, keyboard focus, 44px controls, labels/autocomplete, mismatched confirmation, pending/duplicate submissions, throttled errors, logout failures/success, token URL replacement, real production privacy headers, public admin recovery and protected security redirects. Actual inbox delivery, click tracking, trusted proxy IP behavior and production backup/deployment remain manual checks.

Local results: all **16** focused tests passed without skips; focused lint had no errors, with one pre-existing storefront-search `window.location.assign` warning; TypeScript and Drizzle metadata checks passed. Both isolated production builds passed. The schema-stage build retained Better Auth 1.7.5 and included the runtime migration files/production `pg`. The application-stage build used a disposable auth schema with the rate table and no Resend variables. A preliminary application build against the untouched local schema also completed but reported the expected missing `rateLimit` table; do not follow its broad `npx auth migrate` suggestion. The final fixture-backed build passed without that diagnostic. The actual local public limiter table remains pending, as intended.

Separate dependency-audit result: both the unchanged baseline lock and the application lock report **11** advisories (4 moderate, 6 high, 1 critical). These are unchanged by the Better Auth update. They include [Next.js's critical ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) affecting the installed 16.3.5 version; a source search found no `next/og` or `ImageResponse` usage in this application. Other Next.js and tooling advisories remain for a separate dependency review. No automatic audit fix or framework upgrade was performed.
