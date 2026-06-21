// UPC lookup — server-side only. Provider-agnostic normalization so we can swap
// providers without touching /api/enrich. Default: UPCitemdb trial (no key).
//
// Shared by the /api/lookup proxy route (for the client / CORS) AND by
// /api/enrich (called directly, no internal HTTP hop).

import type { UpcLookupResult } from "@/lib/types";
import { referencePriceFromOffers, type Offer } from "@/lib/price";

const UPCITEMDB_TRIAL = "https://api.upcitemdb.com/prod/trial/lookup";

interface UpcItemDbItem {
  title?: string;
  brand?: string;
  category?: string;
  description?: string;
  images?: string[];
  weight?: string; // e.g. "1.5 pounds" — free text, NOT reliable in kg
  lowest_recorded_price?: number; // junk in practice (0 / bulk outliers) — unused
  // Real per-merchant prices. This is what we aggregate (see lib/price.ts).
  offers?: Offer[];
}

interface UpcItemDbResponse {
  code?: string;
  total?: number;
  items?: UpcItemDbItem[];
}

async function lookupUpcItemDb(clean: string): Promise<UpcLookupResult> {
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

    // Reference price = robust median of the REAL offers (never lowest_recorded_price,
    // which is garbage: 0 or bulk-pack outliers). Null when offers don't support one.
    const ref = referencePriceFromOffers(item.offers);

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
      reference_price_usd: ref.price_usd,
      reference_coherent: ref.coherent,
      reference_sources: ref.sources,
    };
  } catch {
    return { found: false };
  }
}

// OpenFoodFacts — free, no key, no hard rate limit; excellent for groceries
// (Baraki's main flow). Fallback when UPCitemdb misses or is rate-limited.
const OFF_API = "https://world.openfoodfacts.org/api/v2/product/";

interface OffProduct {
  product_name?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
}

// When OFF has the product but no clean product_name (only brand + category —
// the real Bonduelle case), build a true name from those fields instead of
// returning null and letting the LLM "fill in" (and hallucinate).
function composeName(
  productName?: string,
  brands?: string,
  categories?: string,
): string | null {
  const real = productName?.trim();
  if (real) return real;
  const brand = brands?.split(",")[0]?.trim();
  const cat = categories
    ?.split(",")[0]
    ?.trim()
    .replace(/^[a-z]{2}:/i, "") // strip taxonomy prefix like "en:"
    .replace(/-/g, " ")
    .trim();
  const parts = [brand, cat].filter((x): x is string => !!x && x.length > 0);
  return parts.length ? parts.join(" · ") : null;
}

async function lookupOpenFoodFacts(clean: string): Promise<UpcLookupResult> {
  try {
    const res = await fetch(
      `${OFF_API}${encodeURIComponent(clean)}.json?fields=product_name,brands,categories,image_url`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return { found: false };
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    const p = data.product;
    if (data.status !== 1 || !p || (!p.product_name && !p.categories)) {
      return { found: false };
    }
    return {
      found: true,
      name: composeName(p.product_name, p.brands, p.categories),
      brand: p.brands || null,
      category: p.categories || null,
      description: null,
      image_url: p.image_url || null,
      weight: null,
      reference_price_usd: null,
    };
  } catch {
    return { found: false };
  }
}

// GTIN check digit (EAN-13 / UPC-A / EAN-8). Returns false ONLY when the code is
// all-digits of a GTIN length and the check digit doesn't match — i.e. a likely
// mis-scan. Non-numeric or non-GTIN lengths are not our concern → true.
export function isValidGtin(code: string): boolean {
  const c = code.trim();
  if (!/^\d+$/.test(c)) return true;
  if (![8, 12, 13].includes(c.length)) return true;
  const digits = c.split("").map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w;
  }
  return (10 - (sum % 10)) % 10 === check;
}

export async function lookupUpc(barcode: string): Promise<UpcLookupResult> {
  const clean = barcode.trim();
  if (!clean) return { found: false };

  const primary = await lookupUpcItemDb(clean);
  if (primary.found) return primary;

  // OFF indexes most US UPC-12 codes as EAN-13 with a leading zero.
  const off = await lookupOpenFoodFacts(clean);
  if (off.found) return off;
  if (clean.length === 12) return lookupOpenFoodFacts(`0${clean}`);
  return { found: false };
}
