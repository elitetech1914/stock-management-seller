import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { AccountForm } from "@/components/auth/account-form";
import { AccountShell, VerificationReminder, privateAccountMetadata } from "@/components/auth/account-shell";
export const metadata = { ...privateAccountMetadata, title: "Account security" };
export const dynamic = "force-dynamic";
export default async function SecurityPage() {
 const session = await auth.api.getSession({ headers: await headers() });
 if (!session) redirect("/login?next=/account/security");

 return <AccountShell title="Account security" description="Change your password and manage access from other devices."><VerificationReminder verified={session.user.emailVerified} admin={false} /><AccountForm mode="change" admin={false} /><Link href="/account" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#17352c] underline">Back to account</Link></AccountShell>;
}
