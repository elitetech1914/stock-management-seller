import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PUBLIC_ORIGIN } from "@/lib/auth-policy";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

function loginDestination(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return "/account";
  try {
    const url = new URL(next, PUBLIC_ORIGIN);
    const path = decodeURIComponent(url.pathname);
    const normalizedPath = path.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    if (url.origin !== PUBLIC_ORIGIN || path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path) || ["/login", "/admin/login", "/register"].includes(normalizedPath.toLowerCase())) return "/account";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/account";
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const destination = loginDestination((await searchParams).next);
  if (session?.user) redirect(destination);
  return <LoginForm redirectTo={destination} />;
}
