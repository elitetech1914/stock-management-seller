import "server-only";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { after } from "next/server";
import type { AccountEmail } from "./auth-options";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function accountEmailTemplate(message: AccountEmail) {
  const reset = message.kind === "reset";
  const subject = reset ? "Reset your Apex Trade Alliance password" : "Verify your Apex Trade Alliance email";
  const heading = reset ? "Reset your password" : "Verify your email address";
  const instruction = reset ? "Use this single-use link within 30 minutes to choose a new password." : "Confirm your email address using this link within 24 hours. You can continue using your account without verification.";
  const action = reset ? "Reset password" : "Verify email";
  const text = `Apex Trade Alliance\n\n${heading}\n\nHello ${message.name},\n\n${instruction}\n\n${action}: ${message.url}\n\nIf you did not request this email, you can ignore it.\nApex Trade Alliance`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f2;color:#17352c;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px;background:white;border-radius:24px"><p style="font-weight:bold">Apex Trade Alliance</p><h1 style="font-size:28px">${heading}</h1><p>Hello ${escapeHtml(message.name)},</p><p style="line-height:1.6">${instruction}</p><p style="margin:28px 0"><a href="${escapeHtml(message.url)}" style="display:inline-block;padding:14px 22px;background:#17352c;color:white;border-radius:12px;text-decoration:none">${action}</a></p><p style="line-height:1.6">If the button does not work, copy this link into your browser:</p><p style="overflow-wrap:anywhere"><a href="${escapeHtml(message.url)}">${escapeHtml(message.url)}</a></p><p style="color:#666;line-height:1.6">If you did not request this email, you can ignore it.</p></main></body></html>`;
  return { subject, text, html };
}

// Called only inside after(): email availability never changes the public response.
export async function deliverAccountEmail(message: AccountEmail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.error("Account email", { kind: message.kind, outcome: "missing-runtime-configuration" });
    return false;
  }
  const idempotencyKey = `account-${message.kind}-${createHash("sha256").update(message.email + "\0" + message.url).digest("hex")}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let retry = true;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ from, to: [message.email], ...accountEmailTemplate(message) }),
        signal: AbortSignal.timeout(5000),
      });
      await response.body?.cancel();
      if (response.ok) {
        console.info("Account email", { kind: message.kind, outcome: "accepted", attempt });
        return true;
      }
      retry = response.status === 429 || response.status >= 500;
      console.error("Account email", { kind: message.kind, outcome: "provider-rejected", status: response.status, attempt });
    } catch {
      console.error("Account email", { kind: message.kind, outcome: "transport-failed", attempt });
    }
    if (!retry || attempt === 3) break;
    await delay(250 * attempt);
  }
  return false;
}

export function scheduleAccountEmail(message: AccountEmail) {
  try { after(async () => { await deliverAccountEmail(message); }); }
  catch { console.error("Account email", { kind: message.kind, outcome: "scheduling-failed" }); }
}
