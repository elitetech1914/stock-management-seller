"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  useActionState,
  useState,
} from "react";

import { importProducts } from "@/app/admin/(panel)/import/actions";
import { initialImportState } from "@/app/admin/(panel)/import/import-state";

export function ImportProductsForm() {
  const [state, formAction, isPending] =
    useActionState(
      importProducts,
      initialImportState
    );

  const [fileName, setFileName] =
    useState("");

  const [inputKey, setInputKey] =
    useState(0);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    setFileName(
      file?.name ?? ""
    );
  }

  function clearFile() {
    setFileName("");

    setInputKey(
      (current) => current + 1
    );
  }

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6"
      >
        {/* HEADER */}
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
            Upload CSV
          </h2>

          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-500">
            Select a CSV file containing
            your product catalog. Existing
            products are matched using
            their SKU.
          </p>
        </div>

        {/* FILE INPUT */}
        <div className="mt-6">
          <label className="group flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 transition hover:border-neutral-400 hover:bg-neutral-100/60 sm:gap-4 sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-[#17352c] shadow-sm">
              <FileSpreadsheet
                size={19}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {fileName ||
                  "Choose a CSV file"}
              </p>

              <p className="mt-0.5 text-xs text-neutral-500">
                {fileName
                  ? "File ready for import"
                  : "Stockmora or Shopify CSV"}
              </p>
            </div>

            <span className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition group-hover:border-neutral-300">
              Browse
            </span>

            <input
              key={inputKey}
              type="file"
              name="file"
              accept=".csv,text/csv"
              onChange={
                handleFileChange
              }
              className="sr-only"
              required
              disabled={isPending}
            />
          </label>

          {fileName &&
            !isPending && (
              <button
                type="button"
                onClick={clearFile}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-red-600"
              >
                <X size={13} />

                Remove file
              </button>
            )}
        </div>

        {/* SUBMIT */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-5">
          <p className="text-xs text-neutral-400">
            Large catalogs may take a
            moment to process.
          </p>

          <button
            type="submit"
            disabled={
              isPending ||
              !fileName
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#21483d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                />

                Importing...
              </>
            ) : (
              <>
                <Upload size={16} />

                Import products
              </>
            )}
          </button>
        </div>
      </form>

      {/* IMPORT RESULT */}
      {state.message && (
        <section
          className={`rounded-2xl border p-5 ${
            state.success
              ? "border-emerald-200 bg-emerald-50"
              : state.failed > 0
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 ${
                state.success
                  ? "text-emerald-600"
                  : state.failed > 0
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {state.success ? (
                <CheckCircle2
                  size={19}
                />
              ) : (
                <AlertCircle
                  size={19}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className={`font-semibold ${
                  state.success
                    ? "text-emerald-900"
                    : state.failed > 0
                      ? "text-amber-900"
                      : "text-red-900"
                }`}
              >
                {state.message}
              </h3>

              {state.totalRows >
                0 && (
                <p
                  className={`mt-1 text-sm ${
                    state.success
                      ? "text-emerald-700"
                      : state.failed > 0
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  Processed{" "}
                  {state.totalRows} CSV{" "}
                  {state.totalRows ===
                  1
                    ? "row"
                    : "rows"}
                  .
                </p>
              )}
            </div>
          </div>

          {/* RESULT COUNTS */}
          {state.totalRows >
            0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Result
                label="Products created"
                value={
                  state.created
                }
              />

              <Result
                label="Products updated"
                value={
                  state.updated
                }
              />

              <Result
                label="Variants created"
                value={
                  state.variantsCreated
                }
              />

              <Result
                label="Variants updated"
                value={
                  state.variantsUpdated
                }
              />

              <Result
                label="Failed"
                value={
                  state.failed
                }
              />
            </div>
          )}

          {/* ERRORS */}
          {state.errors.length >
            0 && (
            <div className="mt-5 rounded-xl border border-black/5 bg-white/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                Import errors
              </p>

              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {state.errors.map(
                  (
                    error,
                    index
                  ) => (
                    <div
                      key={`${index}-${error}`}
                      className="flex items-start gap-2 text-sm text-neutral-700"
                    >
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />

                      <span>
                        {error}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Result({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/70 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-neutral-950">
        {value}
      </p>
    </div>
  );
}
