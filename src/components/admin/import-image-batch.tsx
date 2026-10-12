"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BatchSelect } from "./batch-select";

type Batch = { id: string; name: string; createdAt: string };

export function ImportImageBatch({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/media/batches", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load image batches.");
      if (!controller.signal.aborted) { setBatches(data.batches); setCursor(data.nextCursor); setError(""); }
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load image batches."); });
    return () => controller.abort();
  }, [attempt]);

  async function loadOlder() {
    if (!cursor || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/media/batches?beforeId=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load older batches.");
      setBatches((previous) => [...previous, ...data.batches]); setCursor(data.nextCursor);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load older batches."); }
    finally { setLoading(false); }
  }

  return <div className="mt-6 border-t border-neutral-100 pt-5">
    <label id="csv-image-batch-label" htmlFor="csv-image-batch" className="ui-label">Image batch</label>
    <input type="hidden" name="batchId" value={value} />
    <BatchSelect id="csv-image-batch" labelledBy="csv-image-batch-label" value={value} onChange={onChange} disabled={disabled || loading}
      options={[{ value: "", label: "No batch — import image URLs only" }, ...batches.map((batch) => ({ value: batch.id, label: `${batch.name} · ${batch.createdAt.slice(0, 10)} · ${batch.id.slice(0, 8)}` }))]} />
    <p className="mt-2 text-xs leading-5 text-muted">Choose the batch containing the exact filenames in image_1–image_5, including their extensions. Leave this empty for URL-only imports.</p>
    <div className="mt-2 flex flex-wrap items-center gap-4">
      <Link href="/admin/bulk-images" className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline underline-offset-4">Upload or review images</Link>
      {cursor && <button type="button" disabled={disabled || loading} onClick={loadOlder} className="min-h-11 text-sm font-medium text-brand disabled:opacity-50">{loading ? "Loading…" : "Load older batches"}</button>}
    </div>
    {error && <div role="status" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
      <p>{error} URL-only imports can still be checked and imported.</p>
      <button type="button" disabled={disabled || loading} onClick={() => setAttempt((previous) => previous + 1)} className="min-h-11 font-semibold underline underline-offset-4 disabled:opacity-50">Reload batches</button>
    </div>}
  </div>;
}
