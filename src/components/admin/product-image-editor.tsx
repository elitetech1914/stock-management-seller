"use client";

/* eslint-disable @next/next/no-img-element -- Preserve existing external images and display optimized media URLs without a remote-host allowlist. */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import { BatchSelect } from "./batch-select";
import { useProductEdit } from "./product-edit-form";
import { appendGalleryAssets, galleryIdentity, type ProductGalleryItem } from "@/lib/media/product-gallery";
import { MAX_UPLOAD_SELECTION, UPLOAD_CONCURRENCY, type MediaAssetView } from "@/lib/media/shared";
import { sendMediaFile, validateUploadFile } from "@/lib/media/upload-client";

type Batch = { id: string; name: string; createdAt: string };
type Upload = { id: string; file: File; state: "queued" | "uploading" | "processing" | "success" | "error"; progress: number; error?: string };
const control = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-brand hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50";
const galleryControl = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-brand hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50";

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load images. Please retry.");
  return data;
}

function Thumbnail({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex aspect-square max-h-40 w-full items-center justify-center rounded-lg bg-neutral-50">
    {failed ? <div className="p-3 text-center text-xs text-muted"><ImageIcon size={24} aria-hidden="true" className="mx-auto mb-2" />Image unavailable</div>
      : <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain p-3" />}
  </div>;
}

export function ProductImageEditor({ initialImages }: { initialImages: ProductGalleryItem[] }) {
  const { saving, setUploadsBlocked } = useProductEdit();
  const [gallery, setGallery] = useState(() => initialImages.filter((item, index) => initialImages.findIndex((candidate) => galleryIdentity(candidate.url) === galleryIdentity(item.url)) === index));
  const [view, setView] = useState<"library" | "upload">("library");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [batchName, setBatchName] = useState("");
  const [batchCursor, setBatchCursor] = useState<string | null>(null);
  const [batchAttempt, setBatchAttempt] = useState(0);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [assets, setAssets] = useState<MediaAssetView[]>([]);
  const [assetCursor, setAssetCursor] = useState<string | null>(null);
  const [assetRefresh, setAssetRefresh] = useState(0);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const libraryRequest = useRef(0);
  const unresolved = uploads.some((upload) => upload.state !== "success");

  useEffect(() => { setUploadsBlocked(unresolved || busy || creating); }, [unresolved, busy, creating, setUploadsBlocked]);

  useEffect(() => {
    const controller = new AbortController();
    requestJson("/api/admin/media/batches", { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setBatches(data.batches); setBatchCursor(data.nextCursor); setBatchesLoading(false); }
    }).catch((failure) => { if (!controller.signal.aborted) { setError(failure.message); setBatchesLoading(false); } });
    return () => controller.abort();
  }, [batchAttempt]);

  useEffect(() => {
    if (!batchId) return;
    const controller = new AbortController();
    const version = ++libraryRequest.current;
    requestJson(`/api/admin/media/assets?batchId=${encodeURIComponent(batchId)}`, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted && version === libraryRequest.current) { setAssets(data.assets); setAssetCursor(data.nextCursor); setAssetsLoading(false); }
    }).catch((failure) => { if (!controller.signal.aborted && version === libraryRequest.current) { setError(failure.message); setAssetsLoading(false); } });
    return () => controller.abort();
  }, [batchId, assetRefresh]);

  function selectBatch(id: string) {
    libraryRequest.current++;
    setBatchId(id); setAssets([]); setSelected([]); setAssetCursor(null); setAssetsLoading(Boolean(id));
    setUploads((previous) => previous.filter((upload) => upload.state !== "success"));
    setError(""); setNotice("");
  }

  async function createBatch() {
    if (!batchName.trim() || creating || busy || saving) return;
    setCreating(true); setError("");
    try {
      const data = await requestJson("/api/admin/media/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: batchName }) });
      setBatches((previous) => [data.batch, ...previous]); selectBatch(data.batch.id); setBatchName("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not create batch."); }
    finally { setCreating(false); }
  }

  async function loadOlderBatches() {
    if (!batchCursor || batchesLoading) return;
    setBatchesLoading(true); setError("");
    try {
      const data = await requestJson(`/api/admin/media/batches?beforeId=${encodeURIComponent(batchCursor)}`);
      setBatches((previous) => [...previous, ...data.batches]); setBatchCursor(data.nextCursor);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load batches."); }
    finally { setBatchesLoading(false); }
  }

  async function loadMoreImages() {
    if (!batchId || !assetCursor || assetsLoading) return;
    const version = ++libraryRequest.current;
    setAssetsLoading(true); setError("");
    try {
      const data = await requestJson(`/api/admin/media/assets?batchId=${encodeURIComponent(batchId)}&beforeId=${encodeURIComponent(assetCursor)}`);
      if (version === libraryRequest.current) {
        setAssets((previous) => [...previous, ...data.assets.filter((asset: MediaAssetView) => !previous.some((item) => item.id === asset.id))]); setAssetCursor(data.nextCursor);
      }
    } catch (failure) { if (version === libraryRequest.current) setError(failure instanceof Error ? failure.message : "Could not load images."); }
    finally { if (version === libraryRequest.current) setAssetsLoading(false); }
  }

  function addSelected() {
    const additions = assets.filter((asset) => selected.includes(asset.id));
    if (gallery.length + additions.length > MAX_UPLOAD_SELECTION) { setError(`A product can have up to ${MAX_UPLOAD_SELECTION} images. Select fewer images.`); return; }
    setGallery((current) => appendGalleryAssets(current, additions)); setSelected([]);
    setNotice("Selected images added to the gallery. Save changes to apply them.");
  }

  function addFiles(files: File[]) {
    if (!batchId || busy || saving || creating) return;
    setError(""); setNotice("");
    if (files.length + uploads.length > MAX_UPLOAD_SELECTION || gallery.length + uploads.filter((item) => item.state !== "success").length + files.length > MAX_UPLOAD_SELECTION) {
      setError(`Select up to ${MAX_UPLOAD_SELECTION} images per product. Remove files or gallery images to make room.`); return;
    }
    const names = new Set(uploads.map((upload) => upload.file.name));
    const additions: Upload[] = [];
    let duplicates = 0;
    for (const file of files) {
      if (names.has(file.name)) { duplicates++; continue; }
      names.add(file.name);
      const error = validateUploadFile(file);
      additions.push({ id: crypto.randomUUID(), file, state: error ? "error" : "queued", progress: 0, error });
    }
    setUploads((previous) => [...previous, ...additions]);
    if (duplicates) setNotice(`${duplicates} duplicate filename(s) skipped.`);
  }

  function updateUpload(id: string, changes: Partial<Upload>) {
    setUploads((previous) => previous.map((upload) => upload.id === id ? { ...upload, ...changes } : upload));
  }

  async function uploadFiles() {
    if (running.current || !batchId || saving || creating) return;
    const queue = uploads.filter((upload) => upload.state === "queued");
    if (!queue.length) return;
    if (gallery.length + queue.length > MAX_UPLOAD_SELECTION) { setError("Remove some gallery images or queued files before uploading."); return; }
    running.current = true; setBusy(true); setError(""); setNotice("");
    const completed: (MediaAssetView | undefined)[] = new Array(queue.length);
    let next = 0;
    async function worker() {
      while (next < queue.length) {
        const index = next++;
        const item = queue[index];
        updateUpload(item.id, { state: "uploading", progress: 0, error: undefined });
        try {
          completed[index] = await sendMediaFile(batchId, item.file, (progress, processing) => updateUpload(item.id, { progress, state: processing ? "processing" : "uploading" }));
          updateUpload(item.id, { state: "success", progress: 100 });
        } catch (failure) { updateUpload(item.id, { state: "error", error: failure instanceof Error ? failure.message : "Upload failed." }); }
      }
    }
    try {
      await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
      const additions = completed.filter((asset): asset is MediaAssetView => Boolean(asset));
      setGallery((current) => appendGalleryAssets(current, additions));
      setSelected([]); setAssetsLoading(true); setAssetRefresh((version) => version + 1);
      if (additions.length) setNotice(`${additions.length} uploaded image(s) added to the gallery. Save changes to apply them.`);
    } finally { running.current = false; setBusy(false); }
  }

  function move(index: number, target: number) {
    setGallery((current) => { const next = [...current]; const [item] = next.splice(index, 1); next.splice(target, 0, item); return next; });
  }

  const galleryIds = new Set(gallery.map((item) => galleryIdentity(item.url)));
  const locked = saving || busy || creating;
  const queued = uploads.filter((upload) => upload.state === "queued").length;

  return <section aria-labelledby="product-images-heading" className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
    <input type="hidden" name="imageGallery" value={JSON.stringify(gallery.map((item) => item.reference))} />
    <h2 id="product-images-heading" className="font-semibold">Product images</h2>
    <p className="mt-1 text-sm leading-6 text-muted">Choose uploaded images or upload from your computer. The first image is primary; save changes to update the product.</p>
    {gallery.length ? <ol aria-label="Product gallery" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
      {gallery.map((item, index) => <li key={galleryIdentity(item.url)} className="min-w-0 rounded-xl border border-border p-2">
        <Thumbnail url={item.url} alt={item.altText || `Product image ${index + 1}`} />
        <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs font-medium text-brand">{index === 0 ? "Primary image" : `Image ${index + 1}`}</p>
          <button type="button" disabled={locked} onClick={() => setGallery((current) => current.filter((_, position) => position !== index))} aria-label={`Remove image ${index + 1}`} className={control}><X size={16} aria-hidden="true" /></button></div>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-[1fr_44px_44px]">
          <button type="button" disabled={locked || index === 0} onClick={() => move(index, 0)} className={galleryControl + " col-span-2 sm:col-span-1"}>Make primary</button>
          <button type="button" disabled={locked || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move image ${index + 1} earlier`} className={galleryControl}><ArrowLeft size={16} aria-hidden="true" /></button>
          <button type="button" disabled={locked || index === gallery.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move image ${index + 1} later`} className={galleryControl}><ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </li>)}
    </ol> : <p className="mt-5 rounded-xl bg-neutral-50 p-5 text-sm text-muted">No product images selected. Add images below.</p>}

    <div className="mt-6 border-t border-border pt-5">
      <label id="product-image-batch-label" htmlFor="product-image-batch" className="ui-label">Image batch</label>
      <BatchSelect id="product-image-batch" labelledBy="product-image-batch-label" value={batchId} onChange={selectBatch} disabled={locked || batchesLoading}
        options={[{ value: "", label: batchesLoading ? "Loading batches…" : "Choose an image batch" }, ...batches.map((batch) => ({ value: batch.id, label: `${batch.name} · ${batch.createdAt.slice(0, 10)} · ${batch.id.slice(0, 8)}` }))]} />
      {batchCursor && <button type="button" disabled={locked || batchesLoading} onClick={loadOlderBatches} className={control + " mt-2"}>Load older batches</button>}
      <div className="mt-4">
        <label htmlFor="product-image-batch-name" className="ui-label">New batch name</label>
        <div className="flex flex-wrap gap-2"><input id="product-image-batch-name" value={batchName} onChange={(event) => setBatchName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createBatch(); } }} maxLength={150} disabled={locked || batchesLoading} placeholder="Supplier · October delivery" className="ui-input min-w-0 flex-1" />
          <button type="button" onClick={createBatch} disabled={locked || batchesLoading || !batchName.trim()} className={control}>{creating ? "Creating…" : "Create batch"}</button></div>
      </div>
      {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700"><p>{error}</p>
        {!batchId && <button type="button" disabled={locked || batchesLoading} onClick={() => { setError(""); setBatchesLoading(true); setBatchAttempt((version) => version + 1); }} className={control + " mt-2"}>Reload batches</button>}
      </div>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm leading-6 text-brand">{notice}</p>}
      <div role="group" aria-label="Image source" className="mt-5 flex flex-wrap gap-2">
        <button type="button" aria-pressed={view === "library"} disabled={saving} onClick={() => setView("library")} className={view === "library" ? "ui-button" : control}>Choose from library</button>
        <button type="button" aria-pressed={view === "upload"} disabled={saving} onClick={() => setView("upload")} className={view === "upload" ? "ui-button" : control}>Upload from computer</button>
      </div>

      {view === "library" ? <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">{selected.length} selected in this batch</p><button type="button" disabled={!batchId || locked || assetsLoading} onClick={() => { setAssetsLoading(true); setSelected([]); setError(""); setAssetRefresh((version) => version + 1); }} className={control}>Refresh library</button></div>
        {!batchId ? <p className="py-8 text-sm text-muted">Choose or create a batch to browse images.</p>
          : !assets.length ? <p role="status" className="py-8 text-sm text-muted">{assetsLoading ? "Loading images…" : "No images in this batch yet. Upload images from your computer."}</p>
          : <div className="mt-4 grid max-h-[480px] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 2xl:grid-cols-4">{assets.map((asset) => {
            const added = galleryIds.has(galleryIdentity(asset.url));
            return <label key={asset.id} className={"min-w-0 cursor-pointer rounded-xl border p-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand " + (selected.includes(asset.id) ? "border-brand bg-[#f0f5f1]" : "border-border")}>
              <Thumbnail url={asset.url} alt={asset.originalFilename} />
              <div className="mt-2 flex min-h-11 items-center gap-2"><input type="checkbox" disabled={locked || added} checked={added || selected.includes(asset.id)} onChange={() => setSelected((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id])} aria-label={`Select ${asset.originalFilename}`} className="h-4 w-4 shrink-0 accent-brand" /><span className="min-w-0 break-words text-xs font-medium">{asset.originalFilename}</span></div>
              {added && <p className="text-xs text-muted">Already in gallery</p>}
            </label>;
          })}</div>}
        {assetCursor && <button type="button" disabled={locked || assetsLoading} onClick={loadMoreImages} className={control + " mt-4"}>{assetsLoading ? "Loading…" : "Load more images"}</button>}
        <button type="button" disabled={locked || !selected.length} onClick={addSelected} className="ui-button mt-4">Add selected images</button>
      </div> : <div className="mt-5">
        <p className="text-xs leading-5 text-muted">JPG, PNG and WebP · 10 MiB per file · up to 25 megapixels · no animation</p>
        <div onDragOver={(event) => { event.preventDefault(); if (batchId && !locked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} className={"mt-3 rounded-xl border-2 border-dashed px-4 py-8 text-center " + (dragging ? "border-brand bg-emerald-50" : "border-border bg-neutral-50")}>
          <UploadCloud size={28} aria-hidden="true" className="mx-auto text-brand" />
          <p className="mt-3 text-sm font-medium">{batchId ? "Drop product images here" : "Choose or create an image batch first"}</p>
          <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Select product image files" className="sr-only" disabled={!batchId || locked} onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
          <button type="button" disabled={!batchId || locked} onClick={() => fileInput.current?.click()} className={control + " mt-4"}>Choose images</button>
        </div>
        {!!uploads.length && <div className="mt-4">
          <ul aria-label="Image upload queue" className="max-h-80 divide-y divide-border overflow-auto rounded-xl border border-border">{uploads.map((upload) => <li key={upload.id} className="flex items-start gap-3 p-3">
            {upload.state === "success" ? <CheckCircle2 size={18} aria-hidden="true" className="mt-3 shrink-0 text-emerald-700" /> : <ImageIcon size={18} aria-hidden="true" className="mt-3 shrink-0 text-muted" />}
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{upload.file.name}</p><p role={upload.state === "error" ? "alert" : "status"} className={"mt-1 text-xs leading-5 " + (upload.state === "error" ? "text-red-700" : "text-muted")}>{upload.state === "error" ? upload.error : upload.state === "processing" ? "Optimizing and saving…" : upload.state === "uploading" ? `Uploading ${upload.progress}%` : upload.state === "success" ? "Uploaded" : "Ready to upload"}</p>
              {["uploading", "processing"].includes(upload.state) && <progress value={upload.progress} max={100} aria-label={`Upload progress for ${upload.file.name}`} className="mt-2 h-1.5 w-full accent-brand" />}</div>
            <div className="flex flex-wrap justify-end gap-1">{upload.state === "error" && <button type="button" disabled={locked} onClick={() => updateUpload(upload.id, { state: "queued", error: undefined, progress: 0 })} className={control}>Retry</button>}
              <button type="button" disabled={locked} onClick={() => setUploads((current) => current.filter((item) => item.id !== upload.id))} aria-label={`Remove ${upload.file.name} from upload queue`} className={control}><X size={15} aria-hidden="true" /></button></div>
          </li>)}</ul>
          <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={locked} onClick={() => setUploads([])} className={control}>Clear upload list</button>
            <button type="button" onClick={uploadFiles} disabled={locked || !queued} className="ui-button">{busy ? <><Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Uploading…</> : `Upload ${queued} images`}</button></div>
        </div>}
        {unresolved && <p role="status" className="mt-3 text-xs leading-5 text-muted">Upload, retry or remove queued files before saving. After a timeout, refresh the library before retrying; the image may already be uploaded.</p>}
      </div>}
    </div>
  </section>;
}
