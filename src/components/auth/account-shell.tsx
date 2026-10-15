import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const privateAccountMetadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export function AccountShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="flex w-full justify-center bg-[#f4f7f2] px-4 py-10 sm:px-6 sm:py-16"><section className="w-full max-w-lg rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-9"><p className="text-xs font-semibold uppercase tracking-wider text-[#557268]">{siteConfig.name}</p><h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">{title}</h1><p className="mb-7 mt-3 text-sm leading-6 text-neutral-500">{description}</p>{children}</section></main>;
}

export function VerificationReminder({ verified, admin = false }: { verified: boolean; admin?: boolean }) {
  if (verified) return <p className="mb-6 text-sm text-[#17352c]">Your email address is verified.</p>;
  return <div className="mb-6 rounded-xl border border-[#d9e5d4] bg-[#f4f7f2] p-4 text-sm leading-6"><p>Your email address is not verified. You can continue using your account.</p><Link href={admin ? "/verify-email?context=admin" : "/verify-email"} className="mt-2 inline-flex min-h-11 items-center font-semibold text-[#17352c] underline focus-visible:outline-2">Send a verification email</Link></div>;
}
