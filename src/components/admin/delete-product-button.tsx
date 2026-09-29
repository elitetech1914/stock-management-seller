"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { deleteProduct } from "@/app/admin/(panel)/products/actions";

type DeleteProductButtonProps = {
  id: string;
  title?: string;
};

export function DeleteProductButton({
  id,
  title,
}: DeleteProductButtonProps) {
  const [isConfirming, setIsConfirming] =
    useState(false);

  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        <form action={deleteProduct}>
          <input
            type="hidden"
            name="id"
            value={id}
          />

          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700"
          >
            Confirm delete
          </button>
        </form>

        <button
          type="button"
          onClick={() =>
            setIsConfirming(false)
          }
          className="inline-flex h-8 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const confirmed =
          window.confirm(
            title
              ? `Permanently delete "${title}"? This cannot be undone.`
              : "Permanently delete this product? This cannot be undone."
          );

        if (confirmed) {
          setIsConfirming(true);
        }
      }}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-600 transition hover:bg-red-50"
    >
      <Trash2 size={13} />
      Delete
    </button>
  );
}