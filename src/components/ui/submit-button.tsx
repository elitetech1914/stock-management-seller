"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({ children, pendingLabel = "Saving...", disabled, className = "ui-button", ...props }: Omit<ComponentProps<"button">, "type"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending} className={className + " disabled:cursor-not-allowed disabled:opacity-50"}>
    {pending ? <span role="status" className="inline-flex items-center justify-center gap-2"><Loader2 size={16} aria-hidden="true" className="animate-spin" />{pendingLabel}</span> : children}
  </button>;
}
