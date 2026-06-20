// Pluggable AI provider contract. The rest of the app depends only on this
// interface, never on a concrete vendor. Swap GeminiProvider for another
// implementation without touching the API routes.

import type {
  DeepPriceResult,
  EnrichedProduct,
  IdentifiedProduct,
  RawLookupData,
} from "@/lib/types";

export interface AIProvider {
  /**
   * Normalize/translate a product to Spanish from a barcode + whatever the UPC
   * lookup returned. Must NOT invent weight — leave it null unless rawData has it.
   * Must NOT invent price either — price is computed from real offers elsewhere.
   */
  enrichText(barcode: string | null, rawData: RawLookupData): Promise<EnrichedProduct>;

  /** Identify a product from a base64 image (no-barcode flow). */
  identifyFromImage(imageBase64: string): Promise<IdentifiedProduct>;

  /**
   * Deep price search: use a web-search-capable model to find a real market
   * price WITH cited sources. MUST return price_usd null when no real source
   * backs it (never invent). Powers the manual "Búsqueda Profunda" button.
   */
  deepPriceSearch(name: string, barcode: string | null): Promise<DeepPriceResult>;
}
