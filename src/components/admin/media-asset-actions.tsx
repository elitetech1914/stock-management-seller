"use client";

import { useId, useRef, useState } from "react";
import type { MediaAssetView } from "@/lib/media/shared";

export const mediaControl = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-brand hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

export function MediaAssetActions({ asset, disabled, onBusy, onChanged, onMessage }: {
  asset: MediaAssetView; disabled: boolean; onBusy: (busy: boolean) => void;
  onChanged: () => void; onMessage: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [mode, setMode] = useState<"rename" | "delete">("rename");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inUse = Boolean(asset.usageCount);

  function open(next: "rename" | "delete") {
    setMode(next); setName(asset.descriptiveName || asset.effectiveName || asset.originalFilename.replace(/\.[^.]+$/, "")); setError("");
    dialog.current?.showModal();
  }

  async function save(reset = false) {
    if (busy || (mode === "delete" && inUse)) return;
    setBusy(true); onBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/media/assets/${asset.id}`, {
        method: mode === "rename" ? "PATCH" : "DELETE",
        ...(mode === "rename" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descriptiveName: reset ? null : name }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The image could not be updated. Please retry.");
      dialog.current?.close();
      onMessage(mode === "delete" ? `Deleted ${asset.originalFilename}.` : reset ? "Automatic image naming restored." : "Image name updated for every product using it.");
      onChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update image.");
      // Reload pending deletion status while keeping this keyed dialog and error.
      if (mode === "delete") onChanged();
    }
    finally { setBusy(false); onBusy(false); }
  }

  return <>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={disabled || asset.deletionPending} onClick={() => open("rename")} aria-label={`Rename ${asset.originalFilename}`} className={mediaControl}>Rename</button>
      <button type="button" disabled={disabled} onClick={() => open("delete")} aria-label={`Delete ${asset.originalFilename}`} className={mediaControl + " text-red-700 hover:bg-red-50"}>{asset.deletionPending ? "Retry delete" : "Delete"}</button>
    </div>
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (busy) event.preventDefault(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) dialog.current?.close(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-white p-5 text-foreground shadow-2xl backdrop:bg-black/30 sm:p-6">
      <h3 id={titleId} className="text-lg font-semibold tracking-tight">{mode === "rename" ? "Rename image" : inUse ? "Image is used by products" : "Delete image?"}</h3>
      <p className="mt-3 break-words text-sm leading-6 text-muted">Original filename: <span className="font-medium text-foreground">{asset.originalFilename}</span></p>
      {mode === "rename" ? <>
        <label htmlFor={inputId} className="ui-label mt-4">Descriptive image name</label>
        <input id={inputId} autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={255} disabled={busy} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (name.trim()) void save(); } }} className="ui-input w-full" />
        <p className="mt-3 text-sm leading-6 text-muted">This name applies to every product using the image. Gallery order supplies the image number. The original filename stays unchanged and existing links keep working.</p>
      </> : <p className="mt-3 text-sm leading-6 text-muted">{inUse ? "Remove this image from every product gallery and variant before deleting it." : "The uploaded file will be permanently removed from storage. Its original filename remains in the archive."}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {mode === "rename" && asset.descriptiveName && <button type="button" disabled={busy} onClick={() => save(true)} className={mediaControl}>Use automatic name</button>}
        <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className={mediaControl}>Cancel</button>
        <button type="button" disabled={busy || (mode === "delete" ? inUse : !name.trim())} onClick={() => save()} className={"ui-button " + (mode === "delete" ? "bg-red-700 hover:bg-red-800" : "")}>{busy ? "Saving…" : mode === "rename" ? "Save name" : "Delete image"}</button>
      </div>
    </dialog>
  </>;
}
