// UPC lookup — server-side only. Provider-agnostic normalization so we can swap
// providers without touching /api/enrich. Default: UPCitemdb trial (no key).
//
// Shared by the /api/lookup proxy route (for the client / CORS) AND by
// /api/enrich (called directly, no internal HTTP hop).

import type { UpcLookupResult } from "@/lib/types";

const UPCITEMDB_TRIAL = "https://api.upcitemdb.com/prod/trial/lookup";

interface UpcItemDbItem {
  title?: string;
  brand?: string;
  category?: string;
  description?: string;
  images?: string[];
  weight?: string; // e.g. "1.5 pounds" — free text, NOT reliable in kg
  lowest_recorded_price?: number;
}

interface UpcItemDbResponse {
  code?: string;
  total?: number;
  items?: UpcItemDbItem[];
}

export async function lookupUpc(barcode: string): Promise<UpcLookupResult> {
  const clean = barcode.trim();
  if (!clean) return { found: false };

  try {
    const res = await fetch(
      `${UPCITEMDB_TRIAL}?upc=${encodeURIComponent(clean)}`,
      {
        headers: { Accept: "application/json" },
        // Don't cache aggressively; trial has tight rate limits.
        cache: "no-store",
      },
    );
    if (!res.ok) return { found: false };

    const data = (await res.json()) as UpcItemDbResponse;
    const item = data.items?.[0];
    if (!item) return { found: false };

    return {
      found: true,
      name: item.title ?? null,
      brand: item.brand ?? null,
      category: item.category ?? null,
      description: item.description ?? null,
      image_url: item.images?.[0] ?? null,
      // weight from UPCitemdb is free text ("1.5 pounds"); we do NOT trust it as
      // a numeric kg value. Leave null — weight is never invented.
      weight: null,
      reference_price_usd:
        typeof item.lowest_recorded_price === "number"
          ? item.lowest_recorded_price
          : null,
    };
  } catch {
    return { found: false };
  }
}
