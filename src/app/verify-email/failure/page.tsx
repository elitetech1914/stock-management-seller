import Link from "next/link";
import { AccountShell, privateAccountMetadata } from "@/components/auth/account-shell";
export const metadata = { ...privateAccountMetadata, title: "Email verification" };
export const dynamic = "force-dynamic";
export default async function VerificationResult({ searchParams }: { searchParams: Promise<{ context?: string }> }) {
 const admin = (await searchParams).context === "admin";
 return <AccountShell title="Unable to verify email" description="This link is invalid or expired. You can request a new link and continue using your account."><Link className="inline-flex min-h-11 items-center font-semibold text-[#17352c] underline" href={admin ? "/verify-email?context=admin" : "/verify-email"}> Request a new verification link</Link></AccountShell>;
}
