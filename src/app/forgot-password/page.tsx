import { AccountForm } from "@/components/auth/account-form";
import { AccountShell, privateAccountMetadata } from "@/components/auth/account-shell";
export const metadata = { ...privateAccountMetadata, title: "Forgot password" };
export const dynamic = "force-dynamic";
export default function ForgotPasswordPage() { return <AccountShell title="Forgot your password?" description="Enter your email to request a reset link. The link expires in 30 minutes."><AccountForm mode="forgot" admin={false} /></AccountShell>; }
