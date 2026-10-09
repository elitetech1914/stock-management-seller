"use client";

import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import {
  FormEvent,
  useState,
} from "react";

import { authClient } from "@/lib/auth-client";

function getSafeRedirect() {
  if (typeof window === "undefined") {
    return "/account";
  }

  const params = new URLSearchParams(
    window.location.search
  );

  const next = params.get("next");

  // Default destination for a normal buyer login.
  if (!next) {
    return "/account";
  }

  // Only allow internal application paths.
  // Prevents redirects such as:
  // //malicious-site.com
  // https://malicious-site.com
  if (
    !next.startsWith("/") ||
    next.startsWith("//")
  ) {
    return "/account";
  }

  return next;
}

export default function LoginPage() {
  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [
    showPassword,
    setShowPassword,
  ] = useState(false);
  const [error, setError] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");

    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (!cleanEmail) {
      setError(
        "Please enter your email address."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter your password."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await authClient.signIn.email({
          email: cleanEmail,
          password,
        });

      if (result.error) {
        setError(
          result.error.message ||
            "Unable to sign in. Please check your email and password."
        );

        return;
      }

      const destination =
        getSafeRedirect();

      // Full navigation ensures the newly created
      // Better Auth session is picked up everywhere.
      window.location.assign(
        destination
      );
    } catch (error) {
      console.error(
        "Buyer sign-in failed:",
        error
      );

      setError(
        "Unable to sign in. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-120px)] bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(23,53,44,0.06)] lg:grid-cols-[0.9fr_1.1fr]">
        {/* LEFT SIDE */}
        <section className="hidden bg-[#17352c] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link
              href="/"
              className="inline-block text-3xl font-semibold tracking-[-0.05em]"
            >
              stockmora
            </Link>

            <div className="mt-20 max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Wholesale made simple
              </p>

              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em]">
                Welcome back to your
                Stockmora account.
              </h1>

              <p className="mt-5 max-w-sm text-base leading-7 text-white/70">
                Sign in to manage your
                wholesale orders, review
                previous purchases and
                continue shopping.
              </p>
            </div>
          </div>

          <div className="border-t border-white/15 pt-6">
            <p className="text-sm leading-6 text-white/60">
              Built for independent
              retailers who want a
              straightforward wholesale
              ordering experience.
            </p>
          </div>
        </section>

        {/* LOGIN */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16 lg:py-16">
          <div className="w-full max-w-md">
            <div className="mb-9">
              <Link
                href="/"
                className="mb-8 inline-block text-2xl font-semibold tracking-[-0.05em] text-[#17352c] lg:hidden"
              >
                stockmora
              </Link>

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#557268]">
                Buyer account
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
                Sign in
              </h2>

              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Access your account,
                orders and wholesale
                catalog.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              aria-busy={isSubmitting}
              className="space-y-5"
            >
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-neutral-800"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
                  />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    placeholder="you@example.com"
                    className="h-13 w-full rounded-xl border border-neutral-300 bg-white pl-11 pr-4 text-[15px] text-neutral-950 outline-none transition placeholder:text-neutral-500 focus:border-[#17352c] focus:ring-2 focus:ring-[#17352c]/10"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-neutral-800"
                  >
                    Password
                  </label>
                </div>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
                  />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    className="h-13 w-full rounded-xl border border-neutral-300 bg-white pl-11 pr-12 text-[15px] text-neutral-950 outline-none transition placeholder:text-neutral-500 focus:border-[#17352c] focus:ring-2 focus:ring-[#17352c]/10"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current
                      )
                    }
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-neutral-500 transition hover:text-neutral-700"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                >
                  {error}
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#102a22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Signing in..."
                  : "Sign in"}

                {!isSubmitting && (
                  <ArrowRight
                    size={17}
                  />
                )}
              </button>
            </form>

            {/* REGISTER */}
            <div className="mt-8 border-t border-neutral-200 pt-7 text-center">
              <p className="text-sm text-neutral-500">
                New to Stockmora?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-[#17352c] transition hover:text-[#0e2a21]"
                >
                  Create a buyer account
                </Link>
              </p>
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/"
                className="text-xs font-medium text-neutral-500 transition hover:text-neutral-900"
              >
                ← Back to storefront
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}