import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import type { Pool } from "pg";
import { siteConfig } from "../config/site";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PUBLIC_ORIGIN } from "./auth-policy";

export type AccountEmail = { kind: "reset" | "verification"; email: string; name: string; url: string };

export function configuredAuthOrigin(production: boolean, configured?: string) {
  if (production && !configured) throw new Error("BETTER_AUTH_URL is required in production.");
  const url = new URL(configured || "http://localhost:3000");
  if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("BETTER_AUTH_URL must be a website origin.");
  if (production && url.origin !== PUBLIC_ORIGIN) throw new Error(`Production BETTER_AUTH_URL must match ${PUBLIC_ORIGIN}.`);
  return url.origin;
}

export function accountAuthOptions(database: Pool, baseURL: string, secret: string | undefined, scheduleEmail: (message: AccountEmail) => void) {
  return {
    appName: siteConfig.name,
    database,
    baseURL,
    secret,
    trustedOrigins: baseURL === PUBLIC_ORIGIN ? [PUBLIC_ORIGIN] : ["http://localhost:3000", "http://localhost:3001"],
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => { scheduleEmail({ kind: "reset", email: user.email, name: user.name, url }); },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => { scheduleEmail({ kind: "verification", email: user.email, name: user.name, url }); },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 10 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    plugins: [admin({ defaultRole: "user" })],
  } satisfies BetterAuthOptions;
}
