"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Notice() {
  const params = useSearchParams();
  return params.get("reset") === "success" ? <p role="status" className="mb-5 rounded-xl bg-[#eaf0e7] p-4 text-sm leading-6 text-[#17352c]">Your password was reset. Sign in with your new password.</p> : null;
}
export function ResetSuccessNotice() { return <Suspense><Notice /></Suspense>; }
