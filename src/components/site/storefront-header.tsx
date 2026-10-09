"use client";

import { usePathname } from "next/navigation";
import { Header } from "./header";

export function StorefrontHeader() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <Header />;
}
