"use client";
import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ destination, className }: { destination: "/" | "/admin/login"; className: string }) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) setError("Unable to sign out. Please try again.");
      else window.location.replace(destination);
    } catch { setError("Unable to sign out. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }
  return <><button type="button" onClick={signOut} disabled={pending} className={className + " min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17352c] disabled:opacity-60"}><LogOut size={17} aria-hidden="true" />{pending ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="px-3 py-2 text-sm text-red-700">{error}</p>}</>;
}
