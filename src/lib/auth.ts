import { betterAuth } from "better-auth";
import { pool } from "../db/pool";
import { accountAuthOptions, configuredAuthOrigin } from "./auth-options";
import { scheduleAccountEmail } from "./account-email";

const isProduction = process.env.NODE_ENV === "production";
const baseURL = configuredAuthOrigin(isProduction, process.env.BETTER_AUTH_URL);
if (isProduction && !process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required in production.");

export const auth = betterAuth(accountAuthOptions(pool, baseURL, process.env.BETTER_AUTH_SECRET, scheduleAccountEmail));
