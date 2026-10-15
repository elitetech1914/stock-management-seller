"use client";

import Link from "next/link";
import { ResetSuccessNotice } from "@/components/auth/reset-success-notice";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { authError } from "@/lib/auth-policy";
import { siteConfig } from "@/config/site";

export default function AdminLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(authError(result.error, result.error.message ?? "Unable to sign in."));
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-5">
      <div className="w-full max-w-md rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-10">
        <div className="mb-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17352c] text-white">
            <LockKeyhole size={21} />
          </div>

          <p className="text-sm font-medium text-neutral-500">
            {siteConfig.name}
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
            Admin sign in
          </h1>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Manage products, inventory, customers and orders.
          </p>
        </div>

        <ResetSuccessNotice />
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              className="h-12 w-full rounded-xl border border-neutral-300 px-4 outline-none transition focus:border-[#17352c]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-xl border border-neutral-300 px-4 outline-none transition focus:border-[#17352c]"
            />
          </div>

          <Link href="/admin/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#17352c] underline focus-visible:outline-2">Forgot password?</Link>
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[#17352c] text-sm font-semibold text-white transition hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
