"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authError, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_GUIDANCE, passwordError } from "@/lib/auth-policy";

type Props = { mode: "forgot" | "reset" | "verify" | "change"; admin?: boolean; token?: string; invalid?: boolean };
const inputClass = "h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-[#17352c] focus:ring-2 focus:ring-[#17352c]/20";
const buttonClass = "min-h-11 w-full rounded-xl bg-[#17352c] px-4 py-3 text-sm font-semibold text-white hover:bg-[#24483d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17352c] disabled:cursor-not-allowed disabled:opacity-60";

export function AccountForm({ mode, admin = false, token, invalid }: Props) {
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revoke, setRevoke] = useState(true);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const login = admin ? "/admin/login" : "/login";
  const forgot = admin ? "/admin/forgot-password" : "/forgot-password";
  const isPassword = mode === "reset" || mode === "change";
  const unavailable = mode === "reset" && (!token || invalid);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function showError(message: string) {
    setError(message);
    errorRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("newPassword") || "");
    if (isPassword) {
      const message = passwordError(password, String(data.get("confirmation") || ""));
      if (message) { showError(message); return; }
    }
    submitting.current = true;
    setPending(true); setError(""); setNotice("");
    try {
      const callbackURL = new URL(admin ? "/verify-email/callback?context=admin" : "/verify-email/callback", window.location.origin).href;
      const email = String(data.get("email") || "").trim().toLowerCase();
      const result = mode === "forgot"
        ? await authClient.requestPasswordReset({ email, redirectTo: new URL(admin ? "/admin/reset-password" : "/reset-password", window.location.origin).href })
        : mode === "verify"
          ? await authClient.sendVerificationEmail({ email, callbackURL })
          : mode === "reset"
            ? await authClient.resetPassword({ token: token!, newPassword: password })
            : await authClient.changePassword({ currentPassword: String(data.get("currentPassword") || ""), newPassword: password, revokeOtherSessions: revoke });
      if (result.error?.status === 429) {
        showError(authError(result.error, "Too many attempts. Please wait before trying again.")); return;
      }
      if (mode === "forgot" || mode === "verify") {
        if (result.error && result.error.status >= 500) { showError("This service is temporarily unavailable. Please try again later."); return; }
        setNotice(mode === "forgot" ? "If an account matches that email, we’ll send a password reset link. Check your inbox and spam folder." : "If that address needs verification, we’ll send a verification link. Check your inbox and spam folder.");
      } else if (result.error) {
        showError(authError(result.error, mode === "reset" ? "This reset link is invalid, expired, or already used. Request a new link." : "Unable to change your password. Check your current password and try again."));
      } else if (mode === "reset") {
        window.location.replace(`${login}?reset=success`);
      } else {
        form.reset(); setRevoke(true); setNotice("Your password was changed." + (revoke ? " Other devices have been signed out." : ""));
      }
    } catch { showError("Unable to complete this request. Please try again."); }
    finally { submitting.current = false; setPending(false); }
  }

  if (unavailable) return <div className="space-y-4"><p role="alert" className="text-sm leading-6 text-neutral-600">This reset link is missing, invalid, or expired. Request a new link to continue.</p><Link href={forgot} className={buttonClass + " inline-flex items-center justify-center"}>Request a new link</Link></div>;

  return <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
    {!isPassword && <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label><input id="email" name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} className={inputClass} /></div>}
    {mode === "change" && <div><label htmlFor="currentPassword" className="mb-2 block text-sm font-medium">Current password</label><input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} /></div>}
    {isPassword && <>
      <div><label htmlFor="newPassword" className="mb-2 block text-sm font-medium">New password</label><input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} required aria-describedby="password-guidance" className={inputClass} /><p id="password-guidance" className="mt-2 text-sm leading-6 text-neutral-500">{PASSWORD_GUIDANCE}</p></div>
      <div><label htmlFor="confirmation" className="mb-2 block text-sm font-medium">Confirm new password</label><input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} required className={inputClass} /></div>
    </>}
    {mode === "change" && <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl p-2 text-sm"><input type="checkbox" checked={revoke} onChange={event => setRevoke(event.target.checked)} className="h-5 w-5 accent-[#17352c] focus-visible:outline-2 focus-visible:outline-offset-2" />Sign out of other devices</label>}
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-[#eaf0e7] p-4 text-sm leading-6 text-[#17352c]">{notice}</p>}
    <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Please wait…" : mode === "forgot" ? "Send reset link" : mode === "verify" ? "Send verification link" : mode === "reset" ? "Reset password" : "Change password"}</button>
    {mode === "reset" && error && <Link href={forgot} className="inline-flex min-h-11 items-center font-semibold text-[#17352c] underline">Request a new reset link</Link>}
    {mode !== "change" && <Link href={login} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#17352c] underline focus-visible:outline-2">Back to sign in</Link>}
  </form>;
}
