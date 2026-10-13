"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { MediaAssetView } from "@/lib/media/shared";
import { MediaAssetActions, mediaControl } from "./media-asset-actions";
import { MediaThumbnail } from "./media-thumbnail";

export function MediaLibrary({ batchId, disabled = false, refreshKey = 0, galleryIds, onAddSelected, onBusyChange }: {
  batchId: string; disabled?: boolean; refreshKey?: number; galleryIds?: Set<string>;
  onAddSelected?: (assets: MediaAssetView[]) => boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState({ q: "", all: false });
  const [all, setAll] = useState(false);
  const [assets, setAssets] = useState<MediaAssetView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const scope = `${batchId}|${filter.all}|${filter.q}`;
  const loadKey = JSON.stringify([scope, refreshKey, version]);
  const [activeKey, setActiveKey] = useState(loadKey);
  const [loadedScope, setLoadedScope] = useState(scope);
  const locked = disabled || busy;

  // Reset scope-dependent state together before rendering a different library.
  // Same-scope refreshes retain cards while the external request is pending.
  if (activeKey !== loadKey) {
    setActiveKey(loadKey); setLoading(Boolean(batchId || filter.all)); setError("");
    if (loadedScope !== scope) { setLoadedScope(scope); setAssets([]); setSelected([]); setCursor(null); setTotal(0); }
  }

  function url(beforeId?: string) {
    const params = new URLSearchParams(filter.all ? { scope: "all" } : { batchId });
    if (filter.q) params.set("q", filter.q);
    if (beforeId) params.set("beforeId", beforeId);
    return `/api/admin/media/assets?${params}`;
  }

  useEffect(() => {
    const controller = new AbortController();
    const request = ++requestVersion.current;
    if (!batchId && !filter.all) return () => controller.abort();
    const params = new URLSearchParams(filter.all ? { scope: "all" } : { batchId });
    if (filter.q) params.set("q", filter.q);
    fetch(`/api/admin/media/assets?${params}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load images.");
      if (!controller.signal.aborted && request === requestVersion.current) {
        setAssets(data.assets); setCursor(data.nextCursor); setTotal(data.total ?? data.assets.length);
        setSelected((previous) => previous.filter((id) => data.assets.some((asset: MediaAssetView) => asset.id === id && !asset.deletionPending)));
      }
    }).catch((failure) => { if (!controller.signal.aborted && request === requestVersion.current) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted && request === requestVersion.current) setLoading(false); });
    return () => controller.abort();
  }, [batchId, filter.q, filter.all, refreshKey, version]);

  async function more() {
    if (!cursor || loading || locked) return;
    const request = ++requestVersion.current;
    setLoading(true); setError("");
    try {
      const response = await fetch(url(cursor), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load images.");
      if (request === requestVersion.current) {
        setAssets((previous) => [...previous, ...data.assets.filter((asset: MediaAssetView) => !previous.some((item) => item.id === asset.id))]);
        setCursor(data.nextCursor); setTotal(data.total ?? total);
      }
    } catch (failure) { if (request === requestVersion.current) setError(failure instanceof Error ? failure.message : "Could not load images."); }
    finally { if (request === requestVersion.current) setLoading(false); }
  }

  function mutationBusy(next: boolean) { setBusy(next); onBusyChange?.(next); }
  function search() { setFilter({ q: query.trim(), all }); setVersion((previous) => previous + 1); }

  return <div className="mt-5">
    <label htmlFor={searchId} className="ui-label">Search images</label>
    <div className="flex flex-wrap gap-2">
      <input id={searchId} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (!locked) search(); } }} maxLength={200} disabled={locked} placeholder="Filename, image name, product or SKU" className="ui-input w-full min-w-0 basis-full sm:w-auto sm:flex-1 sm:basis-auto" />
      <button type="button" disabled={locked} onClick={search} className="ui-button">Search</button>
      {(filter.q || filter.all) && <button type="button" disabled={locked} onClick={() => { setQuery(""); setAll(false); setFilter({ q: "", all: false }); }} className={mediaControl}>Reset</button>}
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted"><input type="checkbox" checked={all} disabled={locked} onChange={(event) => { setAll(event.target.checked); setFilter({ q: query.trim(), all: event.target.checked }); }} className="h-4 w-4 accent-brand" />Search all batches</label>
      <button type="button" disabled={locked || loading || (!batchId && !filter.all)} onClick={() => setVersion((previous) => previous + 1)} className={mediaControl}>Refresh library</button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 break-words rounded-xl bg-neutral-50 p-4 text-sm leading-6 text-brand">{notice}</p>}
    {!assets.length ? <p role="status" className="py-8 text-sm text-muted">{loading ? "Loading images…" : !batchId && !filter.all ? "Choose a batch or search all batches to browse images." : "No images found. Try another search or upload images."}</p> : <>
      <p role="status" className="mt-3 text-sm text-muted">{assets.length} of {total} images{loading ? " · Loading…" : ""}{onAddSelected ? ` · ${selected.length} selected` : ""}</p>
      <div className={"mt-4 grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 " + (onAddSelected ? "max-h-[480px] overflow-y-auto" : "")}>{assets.map((asset) => {
        const added = galleryIds?.has(`asset:${asset.id.toLowerCase()}`);
        return <article key={asset.id} className={"min-w-0 rounded-xl border p-3 " + (selected.includes(asset.id) ? "border-brand bg-[#f0f5f1]" : "border-border")}>
          {asset.deletionPending ? <div className="flex aspect-square max-h-40 items-center justify-center rounded-lg bg-neutral-50"><p className="p-3 text-center text-xs text-muted">Deletion pending</p></div> : <MediaThumbnail url={asset.url} alt={asset.effectiveName || asset.originalFilename} />}
          <p className="mt-3 break-words text-sm font-medium">{asset.effectiveName || asset.originalFilename}</p>
          <p className="mt-1 break-words text-xs leading-5 text-muted">Original: {asset.originalFilename}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{asset.width} × {asset.height} · {Math.ceil(asset.sizeBytes / 1024)} KiB · {asset.descriptiveName ? "Manual name" : "Automatic name"}</p>
          {Boolean(asset.usageCount) && <div className="mt-2 text-xs leading-5 text-muted"><p>Used by {asset.usageCount} product(s)</p>{asset.associations?.slice(0, 2).map((link, index) => <Link key={`${link.productId}-${index}`} href={`/admin/products/${link.productId}/edit`} className="block break-words text-brand underline underline-offset-4">{link.title} · {link.sku}</Link>)}</div>}
          {onAddSelected && <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" disabled={locked || added || asset.deletionPending} checked={Boolean(added) || selected.includes(asset.id)} onChange={() => setSelected((previous) => previous.includes(asset.id) ? previous.filter((id) => id !== asset.id) : [...previous, asset.id])} aria-label={`Select ${asset.originalFilename}`} className="h-4 w-4 shrink-0 accent-brand" />{added ? "Already in gallery" : "Select image"}</label>}
          <button type="button" disabled={locked || asset.deletionPending} onClick={async () => { try { await navigator.clipboard.writeText(asset.url); setNotice(`Copied image URL for ${asset.originalFilename}.`); } catch { setNotice(`Copy this image URL: ${asset.url}`); } }} className={mediaControl + " mt-3 w-full"}>Copy image URL</button>
          <MediaAssetActions asset={asset} disabled={locked} onBusy={mutationBusy} onChanged={() => setVersion((previous) => previous + 1)} onMessage={setNotice} />
        </article>;
      })}</div>
    </>}
    {cursor && <button type="button" disabled={locked || loading} onClick={more} className={mediaControl + " mt-4"}>{loading ? "Loading…" : "Load more images"}</button>}
    {onAddSelected && <button type="button" disabled={locked || loading || !selected.length} onClick={() => { if (onAddSelected(assets.filter((asset) => selected.includes(asset.id) && !asset.deletionPending && !galleryIds?.has(`asset:${asset.id.toLowerCase()}`)))) setSelected([]); }} className="ui-button mt-4">Add selected images</button>}
  </div>;
}
