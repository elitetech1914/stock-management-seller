"use client";

/* eslint-disable @next/next/no-img-element -- External product images and optimized media URLs need no remote-host allowlist. */
import { useState } from "react";
import { ImageIcon } from "lucide-react";

export function MediaThumbnail({ url, alt }: { url: string; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className="flex aspect-square max-h-40 w-full items-center justify-center rounded-lg bg-neutral-50">
    {failedUrl === url ? <div className="p-3 text-center text-xs text-muted"><ImageIcon size={24} aria-hidden="true" className="mx-auto mb-2" />Image unavailable</div>
      : <img src={url} alt={alt} loading="lazy" onError={() => setFailedUrl(url)} className="h-full w-full object-contain p-3" />}
  </div>;
}
