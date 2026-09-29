import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

import { pool } from "../db/pool";

const isProduction =
  process.env.NODE_ENV === "production";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  (isProduction
    ? undefined
    : "http://localhost:3000");

if (
  isProduction &&
  !process.env.BETTER_AUTH_URL
) {
  throw new Error(
    "BETTER_AUTH_URL is required in production."
  );
}

if (
  isProduction &&
  !process.env.BETTER_AUTH_SECRET
) {
  throw new Error(
    "BETTER_AUTH_SECRET is required in production."
  );
}

const trustedOrigins =
  isProduction
    ? [
        process.env.BETTER_AUTH_URL!,
      ]
    : [
        "http://localhost:3000",
        "http://localhost:3001",
      ];

export const auth = betterAuth({
  appName: "Stockmora",

  database: pool,

  /*
   * Better Auth recommends explicitly
   * defining the public base URL instead
   * of relying on request inference.
   */
  baseURL,

  /*
   * Better Auth also reads this variable
   * automatically, but keeping it explicit
   * makes the production requirement clear.
   */
  secret:
    process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins,

  plugins: [
    admin({
      defaultRole: "user",
    }),
  ],
});