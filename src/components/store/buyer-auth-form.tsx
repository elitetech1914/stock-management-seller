"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
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

export function BuyerAuthForm({
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
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage(
        "Please enter your email address."
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (
      isRegister &&
      !name.trim()
    ) {
      setErrorMessage(
        "Please enter your name."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        const result =
          await authClient.signUp.email({
            name: name.trim(),
            email: cleanEmail,
            password,
          });

        if (result.error) {
          setErrorMessage(
            result.error.message ??
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
          setErrorMessage(
            result.error.message ??
              "Incorrect email or password."
          );

          return;
        }
      }

      /*
       * Use a full navigation here so the
       * server-side checkout route immediately
       * sees the newly-created session cookie.
       *
       * The cart remains intact because it is
       * stored in localStorage.
       */
      window.location.assign(
        "/checkout"
      );
    } catch {
      setErrorMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-7">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#17352c] text-white">
          <Building2 size={20} />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Stockmora wholesale
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
          {isRegister
            ? "Create your buyer account"
            : "Welcome back"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {isRegister
            ? "Create an account to continue with your wholesale order."
            : "Sign in to continue with your wholesale order."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {isRegister && (
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-neutral-800"
            >
              Contact name
            </label>

            <div className="relative">
              <UserRound
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />

              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                disabled={
                  isSubmitting
                }
                placeholder="Your name"
                className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#17352c] focus:ring-1 focus:ring-[#17352c] disabled:bg-neutral-50"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-neutral-800"
          >
            Email address
          </label>

          <div className="relative">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              disabled={
                isSubmitting
              }
              placeholder="you@company.com"
              className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#17352c] focus:ring-1 focus:ring-[#17352c] disabled:bg-neutral-50"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-neutral-800"
          >
            Password
          </label>

          <div className="relative">
            <LockKeyhole
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />

            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                isRegister
                  ? "new-password"
                  : "current-password"
              }
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              disabled={
                isSubmitting
              }
              placeholder="Minimum 8 characters"
              className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#17352c] focus:ring-1 focus:ring-[#17352c] disabled:bg-neutral-50"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-50"
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
              size={16}
            />
          )}
        </button>
      </form>

      <div className="mt-6 border-t border-neutral-200 pt-5 text-center text-sm text-neutral-500">
        {isRegister ? (
          <>
            Already have an
            account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#17352c] hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Stockmora?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#17352c] hover:underline"
            >
              Create an account
            </Link>
          </>
        )}
      </div>
    </div>
  );
}