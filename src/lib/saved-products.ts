"use client";

import {
  useSyncExternalStore,
} from "react";

const STORAGE_KEY =
  "stockmora-saved-products-v1";

export type SavedProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  wholesalePriceCents: number;
  retailPriceCents: number;
  stockQuantity: number;
  minimumOrderQuantity: number;
};

/*
 * Important:
 * useSyncExternalStore requires the
 * server snapshot to have a stable
 * reference between renders.
 */
const EMPTY_SAVED_PRODUCTS: SavedProduct[] =
  [];

let savedProducts:
  SavedProduct[] = [];

let initialized = false;

const listeners =
  new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function readStorage() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      savedProducts = [];
      return;
    }

    const parsed =
      JSON.parse(raw);

    savedProducts =
      Array.isArray(parsed)
        ? parsed
        : [];
  } catch {
    savedProducts = [];
  }
}

function initialize() {
  if (
    initialized ||
    typeof window ===
      "undefined"
  ) {
    return;
  }

  initialized = true;

  readStorage();
}

function writeStorage() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        savedProducts
      )
    );
  } catch {
    // Ignore storage failures so
    // storefront functionality
    // continues working.
  }
}

function subscribe(
  listener: () => void
) {
  initialize();

  listeners.add(listener);

  return () => {
    listeners.delete(
      listener
    );
  };
}

function getSnapshot() {
  initialize();

  return savedProducts;
}

/*
 * Must return the SAME object/array
 * reference on every server render.
 *
 * Do not use:
 *
 * return [];
 *
 * because that creates a new array
 * every time.
 */
function getServerSnapshot() {
  return EMPTY_SAVED_PRODUCTS;
}

export function isProductSaved(
  productId: string
) {
  initialize();

  return savedProducts.some(
    (product) =>
      product.id ===
      productId
  );
}

export function saveProduct(
  product: SavedProduct
) {
  initialize();

  const exists =
    savedProducts.some(
      (item) =>
        item.id ===
        product.id
    );

  if (exists) {
    return;
  }

  savedProducts = [
    product,
    ...savedProducts,
  ];

  writeStorage();
  emitChange();
}

export function removeSavedProduct(
  productId: string
) {
  initialize();

  const nextProducts =
    savedProducts.filter(
      (product) =>
        product.id !==
        productId
    );

  if (
    nextProducts.length ===
    savedProducts.length
  ) {
    return;
  }

  savedProducts =
    nextProducts;

  writeStorage();
  emitChange();
}

export function toggleSavedProduct(
  product: SavedProduct
) {
  initialize();

  if (
    savedProducts.some(
      (item) =>
        item.id ===
        product.id
    )
  ) {
    removeSavedProduct(
      product.id
    );

    return false;
  }

  saveProduct(product);

  return true;
}

export function clearSavedProducts() {
  initialize();

  if (
    savedProducts.length ===
    0
  ) {
    return;
  }

  savedProducts = [];

  writeStorage();
  emitChange();
}

export function useSavedProducts() {
  const products =
    useSyncExternalStore(
      subscribe,
      getSnapshot,
      getServerSnapshot
    );

  return {
    products,

    totalSaved:
      products.length,

    isSaved(
      productId: string
    ) {
      return products.some(
        (product) =>
          product.id ===
          productId
      );
    },

    toggle:
      toggleSavedProduct,

    remove:
      removeSavedProduct,

    clear:
      clearSavedProducts,
  };
}

/*
 * Keep saved products synchronized
 * between multiple browser tabs.
 */
if (
  typeof window !==
  "undefined"
) {
  window.addEventListener(
    "storage",
    (event) => {
      if (
        event.key !==
        STORAGE_KEY
      ) {
        return;
      }

      readStorage();
      emitChange();
    }
  );
}