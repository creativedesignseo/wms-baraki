// FEFO (First Expired, First Out) helpers — expiry semáforo logic.
// verde > 60d · amarillo 15–60d · rojo < 15d (incl. caducado).

export type FefoLevel = "none" | "verde" | "amarillo" | "rojo";

export function daysUntil(expiration: string | null, now = new Date()): number | null {
  if (!expiration) return null;
  const exp = new Date(`${expiration}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return null;
  const ms = exp.getTime() - now.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function fefoLevel(expiration: string | null, now = new Date()): FefoLevel {
  const d = daysUntil(expiration, now);
  if (d === null) return "none";
  if (d < 15) return "rojo";
  if (d <= 60) return "amarillo";
  return "verde";
}
