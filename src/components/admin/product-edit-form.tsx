"use client";

import { createContext, startTransition, useActionState, useContext, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ProductEditState } from "@/lib/media/product-gallery";

const EditContext = createContext<{ saving: boolean; setUploadsBlocked: (blocked: boolean) => void; uploadsBlocked: boolean } | null>(null);

export function useProductEdit() {
  const context = useContext(EditContext);
  if (!context) throw new Error("Product image controls must be inside the product editor.");
  return context;
}

export function ProductEditForm({ action, children }: { action: (previous: ProductEditState, data: FormData) => Promise<ProductEditState>; children: ReactNode }) {
  const [uploadsBlocked, setUploadsBlocked] = useState(false);
  const [state, dispatch, saving] = useActionState(action, { error: null });
  // Explicit dispatch avoids React resetting uncontrolled product fields when
  // a save returns an error. All edits remain available for correction/retry.
  return <EditContext.Provider value={{ saving, uploadsBlocked, setUploadsBlocked }}>
    <form method="post" className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={(event) => {
      event.preventDefault();
      if (uploadsBlocked || saving) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => dispatch(data));
    }}>
      {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 xl:col-span-2">{state.error}</p>}
      <fieldset disabled={saving} className="contents">{children}</fieldset>
    </form>
  </EditContext.Provider>;
}

export function ProductEditSaveButton() {
  const { saving, uploadsBlocked } = useProductEdit();
  return <div>
    <button type="submit" disabled={saving || uploadsBlocked} aria-busy={saving} className="ui-button h-12 w-full">
      {saving ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" />Saving…</> : "Save changes"}
    </button>
    {uploadsBlocked && <p role="status" className="mt-2 text-xs leading-5 text-muted">Finish image-library changes, then upload, retry or remove any remaining files before saving.</p>}
  </div>;
}
