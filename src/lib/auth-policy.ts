export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;
export const PASSWORD_GUIDANCE = "Use 15–128 characters. Spaces and passphrases are welcome.";
export const PUBLIC_ORIGIN = "https://www.apextradealliance.com";

export function safeAuthDestination(value: string | string[] | null | undefined, fallback: "/" | "/account") {
  const next = Array.isArray(value) ? value[0] : value;
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, PUBLIC_ORIGIN);
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== PUBLIC_ORIGIN || path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path)) return fallback;
    // Resolve decoded separators and dot segments for loop checks, not for navigation.
    const normalizedPath = new URL(path.replace(/\/{2,}/g, "/"), PUBLIC_ORIGIN).pathname.replace(/\/+$/, "") || "/";
    if (["/login", "/admin/login", "/register"].includes(normalizedPath.toLowerCase())) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function passwordError(password: string, confirmation: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return PASSWORD_GUIDANCE;
  if (password !== confirmation) return "The new passwords do not match.";
  return "";
}

export function authError(error: { status?: number; code?: string; message?: string } | null | undefined, fallback: string) {
  return error?.status === 429 || error?.code === "TOO_MANY_REQUESTS"
    ? "Too many attempts. Wait at least a minute before trying again."
    : fallback;
}

export function verificationDestination(error?: string, context?: string) {
  const destination = error ? "/verify-email/failure" : "/verify-email/success";
  return context === "admin" ? `${destination}?context=admin` : destination;
}
