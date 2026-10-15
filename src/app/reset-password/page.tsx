import { AccountForm } from "@/components/auth/account-form";
import { AccountShell, privateAccountMetadata } from "@/components/auth/account-shell";
export const metadata = { ...privateAccountMetadata, title: "Reset password" };
export const dynamic = "force-dynamic";
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
 const params = await searchParams;
 return <AccountShell title="Reset your password" description="Choose a new password for your buyer account."><AccountForm mode="reset" admin={false} token={typeof params.token === "string" ? params.token : undefined} invalid={Boolean(params.error)} /></AccountShell>;
}
