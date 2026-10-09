"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { siteConfig } from "@/config/site";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const result = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in.");
      return;
    }

    router.push("/admin");
    router.refresh();
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
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@stockmora.com"
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
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-xl border border-neutral-300 px-4 outline-none transition focus:border-[#17352c]"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
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