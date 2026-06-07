// Double-currency helpers. USD is the base; local is always derived.
// approved_price_local = approved_price_usd × exchange_rate_usd.

/**
 * Convert a USD amount to the warehouse's local currency.
 * Returns null when the USD amount is null (price not yet set).
 * Rounds to 2 decimals.
 */
export function usdToLocal(usd: number | null, rate: number): number | null {
  if (usd === null || usd === undefined || Number.isNaN(usd)) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(usd * rate * 100) / 100;
}

/** Format a number as currency for display (no FX, just formatting). */
export function formatMoney(
  amount: number | null,
  currency: string,
  locale = "es-ES",
): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // currency code Intl doesn't recognize (e.g. some local codes) → manual.
    return `${amount.toFixed(2)} ${currency}`;
  }
}
