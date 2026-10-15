import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminLoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect(session.user.role === "admin" ? "/admin" : "/account");
  return <AdminLoginForm />;
}
