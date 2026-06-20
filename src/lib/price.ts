// Reference price from REAL marketplace offers (UPCitemdb `offers[]`).
// This NEVER invents a price: it only aggregates prices that came from real
// merchants. Returns null when the offers don't support a trustworthy number.
//
// Why not `lowest_recorded_price`? It's garbage in practice — verified live:
// Coca-Cola returns lowest=0 (a junk outlier) and highest=67.5 (a bulk pack).
// The same response carries `offers[]` with the real per-merchant prices
// (Walgreens 3.49, Staples 12.99, …), which is what we aggregate here.
//
// Algorithm: clean (USD, positive) → trim outliers with MAD → MEDIAN of
// survivors → coherence gate. The coherence gate decides whether the number is
// solid enough to pre-fill as a suggestion (`coherent: true`) or should be
// shown only as a weak reference / sent to deep search later.

export interface Offer {
  merchant?: string;
  price?: number | string;
  currency?: string;
}

export interface ReferencePrice {
  /** Median of de-outliered USD offers, or null when none are trustworthy. */
  price_usd: number | null;
  /** How many offers survived cleaning + trimming. */
  n_used: number;
  /** Merchant names backing the price (the "fuente"). */
  sources: string[];
  /** True when enough offers agree closely → safe to pre-fill as suggestion. */
  coherent: boolean;
  /** Human-readable why, for logs/labels. */
  reason: string;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function toPrice(v: number | string | undefined): number | null {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function referencePriceFromOffers(
  offers: Offer[] | null | undefined,
): ReferencePrice {
  const empty = (reason: string): ReferencePrice => ({
    price_usd: null,
    n_used: 0,
    sources: [],
    coherent: false,
    reason,
  });

  if (!offers || offers.length === 0) return empty("sin ofertas");

  // 1) Clean: keep positive USD prices only. UPCitemdb leaves currency '' for
  //    USD; drop explicitly non-USD (CAD/EUR/GBP/…) and junk (<= $0.05).
  const clean = offers
    .map((o) => ({ merchant: (o.merchant ?? "").trim(), price: toPrice(o.price), currency: (o.currency ?? "").trim().toUpperCase() }))
    .filter((o) => {
      const isUsd = o.currency === "" || o.currency === "USD" || o.currency === "US" || o.currency === "$";
      return isUsd && o.price !== null && o.price > 0.05;
    });

  if (clean.length === 0) return empty("sin precios USD válidos");

  const prices = clean.map((o) => o.price as number);
  const m = median(prices);

  // 2) Trim outliers with MAD (robust). 1.4826 scales MAD to be comparable to a
  //    standard deviation for normal data. Verified on the briefing data: MAD
  //    keeps the real $3.79 can and drops the $59.99/$113.15 bulk packs, where
  //    IQR would keep them.
  const mad = median(prices.map((p) => Math.abs(p - m))) * 1.4826;
  let survivors: typeof clean;
  if (mad > 0) {
    survivors = clean.filter((o) => Math.abs((o.price as number) - m) <= 3 * mad);
  } else {
    // MAD 0 (many identical prices) → keep a sane ratio band around the median.
    survivors = clean.filter((o) => {
      const p = o.price as number;
      return p >= m * 0.5 && p <= m * 2.0;
    });
  }
  if (survivors.length === 0) survivors = clean;

  // 3) Reference = median of survivors.
  const sp = survivors.map((o) => o.price as number);
  const price = Math.round(median(sp) * 100) / 100;
  const sources = survivors.map((o) => o.merchant).filter((x) => x.length > 0);

  // 4) Coherence gate: enough offers AND low robust dispersion around the price.
  const dispersion =
    price > 0 ? (median(sp.map((p) => Math.abs(p - price))) * 1.4826) / price : 1;
  const coherent = survivors.length >= 3 && dispersion <= 0.6;

  return {
    price_usd: price,
    n_used: survivors.length,
    sources,
    coherent,
    reason: coherent
      ? `mediana de ${survivors.length} comercios`
      : `dispersión ${(dispersion * 100).toFixed(0)}% · n=${survivors.length}`,
  };
}
