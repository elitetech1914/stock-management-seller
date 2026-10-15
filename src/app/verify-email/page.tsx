import { AccountForm } from "@/components/auth/account-form";
import { AccountShell, privateAccountMetadata } from "@/components/auth/account-shell";
export const metadata = { ...privateAccountMetadata, title: "Verify email" };
export const dynamic = "force-dynamic";
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ context?: string }> }) {
 const params = await searchParams;
 return <AccountShell title="Verify your email" description="Request a new verification link. Links expire after 24 hours. Verification is optional and does not prevent you from using your account."><AccountForm mode="verify" admin={params.context === "admin"} /></AccountShell>;
}
