import "server-only";

import { auth } from "@/lib/auth";

export class MediaRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function requireMediaAdmin(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    const expectedOrigin = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
    if (request.headers.get("origin") !== expectedOrigin) {
      throw new MediaRequestError("This request must come from the admin website.", 403);
    }
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new MediaRequestError("Please sign in again.", 401);
  if (session.user.role !== "admin") throw new MediaRequestError("Administrator access is required.", 403);
}

export function mediaErrorResponse(error: unknown) {
  const known = error instanceof MediaRequestError;
  let message = known ? error.message : "Media operation failed. Check database migration and storage configuration, then retry.";
  // Drizzle wraps PostgreSQL errors in `cause`. Inspect without exposing SQL,
  // parameters or database credentials to the client.
  const visited = new Set<unknown>();
  let cause = error;
  while (!known && cause && typeof cause === "object" && !visited.has(cause)) {
    visited.add(cause);
    const value = cause as { code?: string; message?: string; cause?: unknown };
    if (value.code === "42P01" && typeof value.message === "string" && /\b(import_batches|media_assets)\b/.test(value.message)) {
      message = "Bulk Images database tables are missing. Apply the media database migration, then reload this page.";
      break;
    }
    cause = value.cause;
  }
  return Response.json({ error: message }, {
    status: known ? error.status : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
