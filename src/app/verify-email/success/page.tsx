import Link from "next/link";
import { AccountShell, privateAccountMetadata } from "@/components/auth/account-shell";
export const metadata = { ...privateAccountMetadata, title: "Email verification" };
export const dynamic = "force-dynamic";
export default async function VerificationResult({ searchParams }: { searchParams: Promise<{ context?: string }> }) {
 const admin = (await searchParams).context === "admin";
 return <AccountShell title="Email verified" description="Your email address has been confirmed. Sign in to continue."><Link className="inline-flex min-h-11 items-center font-semibold text-[#17352c] underline" href={admin ? "/admin/login" : "/login"}> Continue to sign in</Link></AccountShell>;
}
