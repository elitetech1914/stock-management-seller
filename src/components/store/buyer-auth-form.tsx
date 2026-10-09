"use client";

import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import {
  FormEvent,
  useState,
} from "react";

import { authClient } from "@/lib/auth-client";

type BuyerAuthFormProps = {
  mode: "login" | "register";
};

function getSafeRedirect() {
  if (typeof window === "undefined") {
    return "/";
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const next =
    params.get("next");

  if (!next) {
    return "/";
  }

  // Only allow internal Stockmora paths.
  if (
    !next.startsWith("/") ||
    next.startsWith("//")
  ) {
    return "/";
  }

  const pathname =
    next.split(/[?#]/)[0];

  // Prevent auth redirect loops.
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/admin/login"
  ) {
    return "/";
  }

  return next;
}

export default function BuyerAuthForm({
  mode,
}: BuyerAuthFormProps) {
  const isRegister =
    mode === "register";

  const [name, setName] =
    useState("");

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

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanName =
      name.trim();

    if (
      isRegister &&
      !cleanName
    ) {
      setError(
        "Please enter your name."
      );

      return;
    }

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

    if (
      isRegister &&
      password.length < 8
    ) {
      setError(
        "Password must be at least 8 characters."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        const result =
          await authClient.signUp.email({
            name: cleanName,
            email: cleanEmail,
            password,
          });

        if (result.error) {
          setError(
            result.error.message ||
              "Unable to create your account."
          );

          return;
        }
      } else {
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
      }

      /*
       * Return the buyer to where they
       * were before authentication.
       *
       * If there is no ?next= value,
       * return to the homepage.
       */
      const destination =
        getSafeRedirect();

      window.location.assign(
        destination
      );
    } catch (authError) {
      console.error(
        isRegister
          ? "Buyer registration failed:"
          : "Buyer sign-in failed:",
        authError
      );

      setError(
        isRegister
          ? "Unable to create your account. Please try again."
          : "Unable to sign in. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#557268]">
          Buyer account
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
          {isRegister
            ? "Create your account"
            : "Welcome back"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {isRegister
            ? "Create a buyer account to place and manage wholesale orders."
            : "Sign in to access your account and continue shopping."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-7 space-y-5"
      >
        {isRegister && (
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-neutral-800"
            >
              Name
            </label>

            <div className="relative">
              <UserRound
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
              />

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                autoComplete="name"
                required
                placeholder="Your name"
                className="h-12 w-full rounded-xl border border-neutral-300 bg-white pl-11 pr-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-500 focus:border-[#17352c] focus:ring-2 focus:ring-[#17352c]/10"
              />
            </div>
          </div>
        )}

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
              className="h-12 w-full rounded-xl border border-neutral-300 bg-white pl-11 pr-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-500 focus:border-[#17352c] focus:ring-2 focus:ring-[#17352c]/10"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-neutral-800"
          >
            Password
          </label>

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
              autoComplete={
                isRegister
                  ? "new-password"
                  : "current-password"
              }
              minLength={
                isRegister
                  ? 8
                  : undefined
              }
              required
              placeholder={
                isRegister
                  ? "At least 8 characters"
                  : "Enter your password"
              }
              className="h-12 w-full rounded-xl border border-neutral-300 bg-white pl-11 pr-12 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-500 focus:border-[#17352c] focus:ring-2 focus:ring-[#17352c]/10"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (current) =>
                    !current
                )
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-neutral-700"
            >
              {showPassword ? (
                <EyeOff
                  size={18}
                />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#102a22] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? isRegister
              ? "Creating account..."
              : "Signing in..."
            : isRegister
              ? "Create account"
              : "Sign in"}

          {!isSubmitting && (
            <ArrowRight
              size={17}
            />
          )}
        </button>
      </form>

      <div className="mt-7 border-t border-neutral-200 pt-6 text-center">
        {isRegister ? (
          <p className="text-sm text-neutral-500">
            Already have an
            account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#17352c] hover:text-[#102a22]"
            >
              Sign in
            </Link>
          </p>
        ) : (
          <p className="text-sm text-neutral-500">
            New to Stockmora?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#17352c] hover:text-[#102a22]"
            >
              Create account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}