"use client";

/* eslint-disable @next/next/no-img-element -- These are already optimized Garage images. */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, ImagePlus, Loader2, UploadCloud, X } from "lucide-react";

import { MAX_IMAGE_BYTES, MAX_UPLOAD_SELECTION, UPLOAD_CONCURRENCY, type MediaAssetView } from "@/lib/media/shared";

type Batch = { id: string; name: string; createdAt: string };
type Upload = {
  id: string;
  file: File;
  state: "queued" | "uploading" | "processing" | "success" | "error";
  progress: number;
  error?: string;
};

const fieldClass = "h-11 rounded-xl border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-[#17352c] disabled:opacity-50";
const buttonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#17352c] px-5 text-sm font-medium text-white transition hover:bg-[#224b3f] disabled:cursor-not-allowed disabled:opacity-50";

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed. Please retry.");
  return data;
}

function sendFile(batchId: string, file: File, progress: (percent: number, processing: boolean) => void) {
  return new Promise<MediaAssetView>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/media/upload?batchId=${encodeURIComponent(batchId)}`);
    xhr.timeout = 150_000;
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.min(99, Math.round(event.loaded / event.total * 100)), event.loaded === event.total);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data.asset);
        else reject(new Error(data.error || "Upload failed. Please retry."));
      } catch { reject(new Error("Unexpected upload response. Refresh the library before retrying.")); }
    };
    xhr.onerror = () => reject(new Error("Network error. Refresh the library before retrying."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Refresh the library before retrying."));
    xhr.send(file);
  });
}

export function BulkImages() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [batchCursor, setBatchCursor] = useState<string | null>(null);
  const [batchName, setBatchName] = useState("");
  const [assets, setAssets] = useState<MediaAssetView[]>([]);
  const [assetCursor, setAssetCursor] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Prevent rapid double-clicks from starting duplicate worker groups.
  const running = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    jsonRequest("/api/admin/media/batches", { signal: controller.signal }).then((data) => {
      setBatches(data.batches);
      setBatchCursor(data.nextCursor);
      if (data.batches.length) setBatchId(data.batches[0].id);
      else setLoading(false);
    }).catch((failure) => {
      if (!controller.signal.aborted) { setError(failure.message); setLoading(false); }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!batchId) return;
    const controller = new AbortController();
    jsonRequest(`/api/admin/media/assets?batchId=${batchId}`, { signal: controller.signal }).then((data) => {
      setAssets(data.assets); setAssetCursor(data.nextCursor); setLoading(false);
    }).catch((failure) => {
      if (!controller.signal.aborted) { setError(failure.message); setLoading(false); }
    });
    return () => controller.abort();
  }, [batchId]);

  function selectBatch(id: string) {
    setBatchId(id); setUploads([]); setAssets([]); setAssetCursor(null);
    setError(""); setNotice(""); setLoading(Boolean(id));
  }

  async function createBatch(event: React.FormEvent) {
    event.preventDefault();
    if (creating || busy) return;
    setCreating(true); setError("");
    try {
      const data = await jsonRequest("/api/admin/media/batches", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: batchName }),
      });
      setBatches((previous) => [data.batch, ...previous]);
      selectBatch(data.batch.id); setBatchName("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not create batch."); }
    finally { setCreating(false); }
  }

  function addFiles(files: File[]) {
    if (!batchId || busy || loading || creating) return;
    setError(""); setNotice("");
    if (files.length + uploads.length > MAX_UPLOAD_SELECTION) {
      setError(`Select up to ${MAX_UPLOAD_SELECTION} files at a time. Clear completed uploads to add more.`); return;
    }
    const names = new Set(uploads.map((upload) => upload.file.name));
    const additions: Upload[] = [];
    let duplicates = 0;
    for (const file of files) {
      if (names.has(file.name)) { duplicates++; continue; }
      names.add(file.name);
      const invalid = !/\.(jpe?g|png|webp)$/i.test(file.name) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        ? "Choose JPG, PNG or WebP images."
        : !file.size || file.size > MAX_IMAGE_BYTES ? "Each image must be between 1 byte and 10 MiB." : undefined;
      additions.push({ id: crypto.randomUUID(), file, state: invalid ? "error" : "queued", progress: 0, error: invalid });
    }
    setUploads((previous) => [...previous, ...additions]);
    if (duplicates) setNotice(`${duplicates} duplicate filename(s) skipped. Each filename must be unique within the batch.`);
  }

  function updateUpload(id: string, patch: Partial<Upload>) {
    setUploads((previous) => previous.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function loadAssets(append = false) {
    if (!batchId) return;
    setLoading(true); setError("");
    try {
      const data = await jsonRequest(`/api/admin/media/assets?batchId=${batchId}${append && assetCursor ? `&beforeId=${assetCursor}` : ""}`);
      setAssets((previous) => append ? [...previous, ...data.assets] : data.assets);
      setAssetCursor(data.nextCursor);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load images."); }
    finally { setLoading(false); }
  }

  async function uploadFiles() {
    if (running.current || !batchId) return;
    const queue = uploads.filter((item) => item.state === "queued");
    if (!queue.length) return;
    running.current = true; setBusy(true); setError(""); setNotice("");
    let next = 0;
    async function worker() {
      while (next < queue.length) {
        const item = queue[next++];
        updateUpload(item.id, { state: "uploading", progress: 0, error: undefined });
        try {
          await sendFile(batchId, item.file, (progress, processing) => {
            updateUpload(item.id, { progress, state: processing ? "processing" : "uploading" });
          });
          updateUpload(item.id, { state: "success", progress: 100 });
        } catch (failure) {
          updateUpload(item.id, { state: "error", error: failure instanceof Error ? failure.message : "Upload failed." });
        }
      }
    }
    try { await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker)); await loadAssets(); }
    finally { setBusy(false); running.current = false; }
  }

  async function loadOlderBatches() {
    setCreating(true); setError("");
    try {
      const data = await jsonRequest(`/api/admin/media/batches?beforeId=${encodeURIComponent(batchCursor!)}`);
      setBatches((previous) => [...previous, ...data.batches]); setBatchCursor(data.nextCursor);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load batches."); }
    finally { setCreating(false); }
  }

  const queued = uploads.filter((item) => item.state === "queued").length;
  const succeeded = uploads.filter((item) => item.state === "success").length;
  const failed = uploads.filter((item) => item.state === "error").length;

  return (
    <div className="mt-10 space-y-6">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
      {notice && <p role="status" className="rounded-xl bg-neutral-100 px-5 py-4 text-sm text-neutral-700">{notice}</p>}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="font-semibold">Import batch</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-500">Use a separate batch for each supplier delivery, even when filenames repeat.</p>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div>
            <label htmlFor="media-batch" className="mb-2 block text-sm font-medium">Select batch</label>
            <select id="media-batch" value={batchId} disabled={busy || creating || loading} onChange={(event) => selectBatch(event.target.value)} className={`${fieldClass} w-full`}>
              <option value="">Create a batch to get started</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.createdAt.slice(0, 10)} · {batch.id.slice(0, 8)}</option>)}
            </select>
            {batchCursor && <button type="button" disabled={busy || creating || loading} onClick={loadOlderBatches} className="mt-2 text-sm font-medium text-[#17352c] disabled:opacity-50">Load older batches</button>}
          </div>
          <form onSubmit={createBatch}>
            <label htmlFor="media-batch-name" className="mb-2 block text-sm font-medium">New batch name</label>
            <div className="flex gap-2">
              <input id="media-batch-name" value={batchName} onChange={(event) => setBatchName(event.target.value)} maxLength={150} required placeholder="Supplier · October delivery" disabled={busy || creating} className={`${fieldClass} min-w-0 flex-1`} />
              <button type="submit" disabled={busy || creating || !batchName.trim()} className={buttonClass}>{creating ? <Loader2 size={16} className="animate-spin" /> : "Create"}</button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="font-semibold">Upload images</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-500">JPG, PNG and WebP · 10 MiB per file · up to 25 megapixels · no animation</p>
        <div onDragOver={(event) => { event.preventDefault(); if (batchId && !busy) setDragging(true); }}
          onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
          className={`mt-5 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${dragging ? "border-[#17352c] bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}>
          <UploadCloud size={32} className="mx-auto text-[#17352c]" />
          <p className="mt-3 text-sm font-medium">{batchId ? "Drop your supplier images here" : "Create or select an import batch first"}</p>
          <p className="mt-1 text-xs text-neutral-500">Images upload two at a time and keep their exact original filenames.</p>
          <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Select product images" disabled={!batchId || busy || loading || creating}
            onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={!batchId || busy || loading || creating} className={`${buttonClass} mt-5`}><ImagePlus size={16} />Choose images</button>
        </div>

        {!!uploads.length && <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-neutral-500">{succeeded} uploaded · {queued} queued · {failed} failed</p>
            <div className="flex gap-3">
              <button type="button" disabled={busy} onClick={() => setUploads([])} className="text-sm font-medium text-neutral-600 disabled:opacity-50">Clear list</button>
              <button type="button" onClick={uploadFiles} disabled={busy || !queued || loading || creating} className={buttonClass}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}{busy ? "Uploading…" : `Upload ${queued} images`}
              </button>
            </div>
          </div>
          <ul className="mt-5 max-h-[420px] divide-y divide-neutral-100 overflow-auto rounded-xl border border-neutral-200">
            {uploads.map((item) => <li key={item.id} className="flex items-center gap-4 p-4">
              {item.state === "success" ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <ImagePlus size={18} className="shrink-0 text-neutral-400" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p>
                <p className={`mt-1 text-xs ${item.state === "error" ? "text-red-600" : "text-neutral-500"}`}>
                  {item.state === "error" ? item.error : item.state === "processing" ? "Optimizing and saving…" : item.state === "uploading" ? `Uploading ${item.progress}%` : item.state === "success" ? "Uploaded" : "Ready to upload"}
                </p>
                {(item.state === "uploading" || item.state === "processing") && <progress value={item.progress} max={100} aria-label={`Upload progress for ${item.file.name}`} className="mt-2 h-1.5 w-full accent-[#17352c]" />}
              </div>
              {item.state === "error" && <button type="button" disabled={busy} onClick={() => updateUpload(item.id, { state: "queued", error: undefined, progress: 0 })} className="text-xs font-medium text-[#17352c] disabled:opacity-50">Retry</button>}
              {!busy && <button type="button" aria-label={`Remove ${item.file.name} from upload list`} onClick={() => setUploads((previous) => previous.filter((entry) => entry.id !== item.id))}><X size={16} className="text-neutral-400" /></button>}
            </li>)}
          </ul>
        </>}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="font-semibold">Batch library</h2><p className="mt-1 text-sm text-neutral-500">Uploaded catalog images have public read-only URLs. Copy a URL into a product’s Image URLs field to use it now.</p></div>
          <button type="button" disabled={!batchId || busy || loading} onClick={() => loadAssets()} className="text-sm font-medium text-[#17352c] disabled:opacity-50">Refresh</button>
        </div>
        <p className="mt-3 text-xs leading-5 text-neutral-500">Automatic CSV filename matching will be added in the next milestone. Uploading here does not change existing products.</p>
        {loading ? <p role="status" className="mt-8 flex items-center gap-2 text-sm text-neutral-500"><Loader2 size={16} className="animate-spin" />Loading library…</p>
          : !assets.length ? <p className="py-12 text-center text-sm text-neutral-400">{batchId ? "No images uploaded in this batch yet." : "Select a batch to view its images."}</p>
          : <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-xl border border-neutral-200">
              <div className="aspect-square bg-neutral-50"><img src={asset.url} alt={asset.originalFilename} loading="lazy" className="h-full w-full object-contain p-3" /></div>
              <div className="p-3">
                <p className="truncate text-xs font-medium" title={asset.originalFilename}>{asset.originalFilename}</p>
                <p className="mt-1 text-xs text-neutral-400">{asset.width} × {asset.height} · {Math.ceil(asset.sizeBytes / 1024)} KiB</p>
                <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#17352c]" onClick={async () => {
                  try { await navigator.clipboard.writeText(asset.url); setNotice(`Copied image URL for ${asset.originalFilename}.`); }
                  catch { setNotice(`Copy this image URL: ${asset.url}`); }
                }}><Copy size={13} />Copy image URL</button>
              </div>
            </article>)}
          </div>}
        {assetCursor && <button type="button" disabled={loading || busy} onClick={() => loadAssets(true)} className={`${buttonClass} mt-6`}>Load more images</button>}
      </section>
    </div>
  );
}
