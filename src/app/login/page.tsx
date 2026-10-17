import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeAuthDestination } from "@/lib/auth-policy";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const destination = safeAuthDestination((await searchParams).next, "/account");
  if (session?.user) redirect(destination);
  return <LoginForm redirectTo={destination} />;
}
