"use client";

import { useSyncExternalStore } from "react";

export type CartItem = {
  lineId: string;

  productId: string;
  productSlug: string;
  productName: string;

  variantId: string | null;
  variantName: string | null;

  sku: string | null;
  imageUrl: string | null;

  priceCents: number;
  quantity: number;

  minOrderQuantity: number;
  caseQuantity: number;

  availableStock: number | null;
};

export type CartItemInput = Omit<CartItem, "lineId" | "quantity">;

type CartState = {
  items: CartItem[];
};

export type CartMutationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: "insufficient_stock" | "invalid_quantity";
    };

const STORAGE_KEY = "stockmora-cart-v1";

const EMPTY_STATE: CartState = {
  items: [],
};

let state: CartState = EMPTY_STATE;
let hydrated = false;

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function getLineId(productId: string, variantId: string | null) {
  return `${productId}::${variantId ?? "base"}`;
}

function safePositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.floor(number);
}

function safeNonNegativeInteger(value: unknown, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.floor(number);
}

function sanitizeStoredItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<CartItem>;

  if (
    typeof item.productId !== "string" ||
    typeof item.productSlug !== "string" ||
    typeof item.productName !== "string"
  ) {
    return null;
  }

  const variantId =
    typeof item.variantId === "string" ? item.variantId : null;

  const minOrderQuantity = safePositiveInteger(
    item.minOrderQuantity,
    1,
  );

  const caseQuantity = safePositiveInteger(
    item.caseQuantity,
    1,
  );

  const quantity = safePositiveInteger(item.quantity, 1);

  const priceCents = safeNonNegativeInteger(
    item.priceCents,
    0,
  );

  const availableStock =
    item.availableStock === null ||
    item.availableStock === undefined
      ? null
      : safeNonNegativeInteger(item.availableStock, 0);

  return {
    lineId: getLineId(item.productId, variantId),

    productId: item.productId,
    productSlug: item.productSlug,
    productName: item.productName,

    variantId,
    variantName:
      typeof item.variantName === "string"
        ? item.variantName
        : null,

    sku:
      typeof item.sku === "string"
        ? item.sku
        : null,

    imageUrl:
      typeof item.imageUrl === "string"
        ? item.imageUrl
        : null,

    priceCents,
    quantity,

    minOrderQuantity,
    caseQuantity,

    availableStock,
  };
}

function readStoredCart(): CartState {
  if (typeof window === "undefined") {
    return EMPTY_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return EMPTY_STATE;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as CartState).items)
    ) {
      return EMPTY_STATE;
    }

    const items = (parsed as CartState).items
      .map(sanitizeStoredItem)
      .filter((item): item is CartItem => item !== null);

    return {
      items,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") {
    return;
  }

  hydrated = true;
  state = readStoredCart();
}

function persist() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Ignore storage failures.
  }
}

function setState(nextState: CartState) {
  state = nextState;

  persist();
  emitChange();
}

export function getCartMinimumQuantity(
  item: Pick<
    CartItem,
    "minOrderQuantity" | "caseQuantity"
  >,
) {
  const minimum = Math.max(
    1,
    safePositiveInteger(item.minOrderQuantity, 1),
  );

  const caseQuantity = Math.max(
    1,
    safePositiveInteger(item.caseQuantity, 1),
  );

  return (
    Math.ceil(minimum / caseQuantity) *
    caseQuantity
  );
}

export function getCartQuantityStep(
  item: Pick<CartItem, "caseQuantity">,
) {
  return Math.max(
    1,
    safePositiveInteger(item.caseQuantity, 1),
  );
}

function normalizeQuantity(
  item: Pick<
    CartItem,
    | "minOrderQuantity"
    | "caseQuantity"
    | "availableStock"
  >,
  requestedQuantity: number,
) {
  if (
    !Number.isFinite(requestedQuantity) ||
    requestedQuantity <= 0
  ) {
    return 0;
  }

  const step = getCartQuantityStep(item);
  const minimum = getCartMinimumQuantity(item);

  let quantity =
    Math.ceil(
      Math.max(requestedQuantity, minimum) / step,
    ) * step;

  if (item.availableStock !== null) {
    const maximumValidQuantity =
      Math.floor(item.availableStock / step) *
      step;

    if (maximumValidQuantity < minimum) {
      return 0;
    }

    quantity = Math.min(
      quantity,
      maximumValidQuantity,
    );
  }

  return quantity;
}

export function addCartItem(
  input: CartItemInput,
  requestedQuantity: number,
): CartMutationResult {
  ensureHydrated();

  if (
    !Number.isFinite(requestedQuantity) ||
    requestedQuantity <= 0
  ) {
    return {
      ok: false,
      error: "invalid_quantity",
    };
  }

  const lineId = getLineId(
    input.productId,
    input.variantId,
  );

  const existingItem = state.items.find(
    (item) => item.lineId === lineId,
  );

  const baseItem: CartItem = {
    ...input,
    lineId,
    quantity: existingItem?.quantity ?? 0,
  };

  const requestedTotal =
    (existingItem?.quantity ?? 0) +
    requestedQuantity;

  const normalizedQuantity = normalizeQuantity(
    baseItem,
    requestedTotal,
  );

  if (normalizedQuantity <= 0) {
    return {
      ok: false,
      error: "insufficient_stock",
    };
  }

  const nextItem: CartItem = {
    ...baseItem,
    quantity: normalizedQuantity,
  };

  const otherItems = state.items.filter(
    (item) => item.lineId !== lineId,
  );

  setState({
    items: [...otherItems, nextItem],
  });

  return {
    ok: true,
  };
}

export function setCartItemQuantity(
  lineId: string,
  requestedQuantity: number,
): CartMutationResult {
  ensureHydrated();

  const item = state.items.find(
    (currentItem) =>
      currentItem.lineId === lineId,
  );

  if (!item) {
    return {
      ok: false,
      error: "invalid_quantity",
    };
  }

  if (requestedQuantity <= 0) {
    removeCartItem(lineId);

    return {
      ok: true,
    };
  }

  const normalizedQuantity = normalizeQuantity(
    item,
    requestedQuantity,
  );

  if (normalizedQuantity <= 0) {
    return {
      ok: false,
      error: "insufficient_stock",
    };
  }

  setState({
    items: state.items.map((currentItem) =>
      currentItem.lineId === lineId
        ? {
            ...currentItem,
            quantity: normalizedQuantity,
          }
        : currentItem,
    ),
  });

  return {
    ok: true,
  };
}

export function removeCartItem(lineId: string) {
  ensureHydrated();

  setState({
    items: state.items.filter(
      (item) => item.lineId !== lineId,
    ),
  });
}

export function clearCart() {
  ensureHydrated();

  setState({
    items: [],
  });
}

function getSnapshot() {
  ensureHydrated();

  return state;
}

function getServerSnapshot() {
  return EMPTY_STATE;
}

function handleStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) {
    return;
  }

  state = readStoredCart();
  emitChange();
}

function subscribe(listener: () => void) {
  ensureHydrated();

  listeners.add(listener);

  if (
    listeners.size === 1 &&
    typeof window !== "undefined"
  ) {
    window.addEventListener(
      "storage",
      handleStorage,
    );
  }

  return () => {
    listeners.delete(listener);

    if (
      listeners.size === 0 &&
      typeof window !== "undefined"
    ) {
      window.removeEventListener(
        "storage",
        handleStorage,
      );
    }
  };
}

export function useCart() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const totalItems = snapshot.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const subtotalCents = snapshot.items.reduce(
    (total, item) =>
      total + item.priceCents * item.quantity,
    0,
  );

  return {
    items: snapshot.items,
    totalItems,
    subtotalCents,

    addItem: addCartItem,
    setQuantity: setCartItemQuantity,
    removeItem: removeCartItem,
    clearCart,
  };
}