// Putaway rules engine — deterministic, pure, testable.
// Given a product + batch hints and the warehouse's locations, suggest the best
// location by zone (temperature/hazmat), weight class and level.
//
// Never writes weight back to the product. Weight here is only a placement hint;
// when unknown we assume "ligero" for shelving purposes (not stored).

import type { Location, Zone, WeightClass, Level } from "@/lib/types";
import { fallbackLevel } from "@/lib/levels";

export interface PutawayInput {
  category: string | null;
  weight: number | null; // kg, may be null
  expiration_date: string | null; // perishable hint
}

const HEAVY_KG = 10; // >= this is "pesado"

const FROZEN_HINTS = ["congel", "helado", "frozen", "hielo"];
const FRIDGE_HINTS = [
  "refriger",
  "lácteo",
  "lacteo",
  "leche",
  "queso",
  "carne",
  "pollo",
  "pescado",
  "fresco",
  "yogur",
  "embutido",
];
const HAZMAT_HINTS = [
  "químic",
  "quimic",
  "inflam",
  "aerosol",
  "cloro",
  "lejía",
  "lejia",
  "solvente",
  "pesticida",
  "batería",
  "bateria",
  "gas",
];

function matches(text: string, hints: string[]): boolean {
  return hints.some((h) => text.includes(h));
}

export function inferZone(
  category: string | null,
  hasExpiration: boolean,
): Zone {
  const c = (category ?? "").toLowerCase();
  if (matches(c, HAZMAT_HINTS)) return "hazmat";
  if (matches(c, FROZEN_HINTS)) return "congelado";
  if (matches(c, FRIDGE_HINTS)) return "refrigerado";
  // Perishable with no temperature hint → refrigerated by default (safer).
  if (hasExpiration) return "refrigerado";
  return "general";
}

export function inferWeightClass(weight: number | null): WeightClass {
  if (weight !== null && weight >= HEAVY_KG) return "pesado";
  return "ligero"; // unknown → treat as light for shelving (not stored)
}

// Heavy goods go low; light goods prefer mid then high.
function preferredLevels(weightClass: WeightClass): Level[] {
  return weightClass === "pesado"
    ? ["bajo", "medio", "alto"]
    : ["medio", "alto", "bajo"];
}

export interface PutawaySuggestion {
  location: Location | null;
  zone: Zone;
  weight_class: WeightClass;
  reason: string;
}

/**
 * Pick the best active location. Hard requirement: matching zone.
 * Soft preferences: weight_class match, then level order.
 * Returns location=null when no compatible zone location exists.
 */
export function suggestLocation(
  input: PutawayInput,
  locations: Location[],
): PutawaySuggestion {
  const zone = inferZone(input.category, input.expiration_date !== null);
  const weightClass = inferWeightClass(input.weight);

  const inZone = locations.filter((l) => l.active && l.zone === zone);
  if (inZone.length === 0) {
    return {
      location: null,
      zone,
      weight_class: weightClass,
      reason: `Sin ubicación activa en zona ${zone}`,
    };
  }

  const levelOrder = preferredLevels(weightClass);
  const scored = [...inZone].sort((a, b) => score(a) - score(b));

  function score(l: Location): number {
    let s = 0;
    if (l.weight_class !== weightClass) s += 100; // prefer matching weight class
    s += levelOrder.indexOf(l.level); // 0 best, 2 worst; -1 if unknown
    s += l.capacity > 0 ? 0 : 1000; // de-prioritize zero capacity
    return s;
  }

  return {
    location: scored[0],
    zone,
    weight_class: weightClass,
    reason: `Zona ${zone}, ${weightClass}, nivel ${scored[0].level}`,
  };
}

// ── Chaotic-within-zone bin assignment (Amazon-style stow) ───────────────────

const FULL_PCT = 100;
const FILLING_PCT = 70;

export interface BinForStow {
  id: string;
  station_id: string;
  station_name: string;
  code: string;
  position: number;
  // Physical shelf height (1 = suelo). Null/undefined pre-migration → banded fallback.
  level?: number | null;
  zone: Zone;
  capacity: number;
  used: number; // active units currently in the bin (from bin_occupancy)
  active: boolean;
  hasSameProduct?: boolean; // bin already holds the product being stowed
}

export type BinStripColor = "suggested" | "free" | "filling" | "full";

export interface BinStripCell {
  id: string;
  code: string;
  position: number;
  level: number; // resolved level (real or banded fallback) — drives the color
  pct: number;
  color: BinStripColor;
}

export interface BinSuggestion {
  zone: Zone;
  binId: string | null;
  binCode: string | null;
  binLevel: number | null;
  binPosition: number | null;
  stationId: string | null;
  stationName: string | null;
  strip: BinStripCell[]; // bins of the suggested bin's station, ordered
  reason: string;
}

/** Resolve every bin's level: real DB value, or banded fallback within its station. */
export function resolveLevels(bins: BinForStow[]): Map<string, number> {
  const byStation = new Map<string, BinForStow[]>();
  for (const b of bins) {
    (byStation.get(b.station_id) ?? byStation.set(b.station_id, []).get(b.station_id)!).push(b);
  }
  const out = new Map<string, number>();
  for (const group of byStation.values()) {
    const hasReal = group.some((b) => typeof b.level === "number" && b.level > 0);
    for (const b of group) {
      out.set(
        b.id,
        hasReal && typeof b.level === "number" && b.level > 0
          ? b.level
          : fallbackLevel(b.position, group.length),
      );
    }
  }
  return out;
}

function pctOf(used: number, capacity: number): number {
  if (capacity <= 0) return 100;
  return Math.round((100 * used) / capacity);
}

/**
 * Pick a bin for an item, chaotic but constrained to the right temperature zone.
 * Preference: a bin already holding the same product (consolidation), then the
 * least-full eligible bin. Returns the suggested bin and the color-coded strip
 * for that bin's station so the operator sees exactly where to place it.
 */
export function suggestBin(
  input: PutawayInput & { productId?: string | null; forceZone?: Zone },
  bins: BinForStow[],
): BinSuggestion {
  // The operator works AT a station (which fixes the zone); forceZone uses it.
  // Falls back to inferring the zone from the product when no station is given.
  const zone = input.forceZone ?? inferZone(input.category, input.expiration_date !== null);
  const weightClass = inferWeightClass(input.weight);
  const levels = resolveLevels(bins);

  const inZone = bins.filter((b) => b.active && b.zone === zone);
  const eligible = inZone.filter((b) => b.used < b.capacity);
  const consolidate = eligible.filter((b) => b.hasSameProduct);
  const pool = consolidate.length > 0 ? consolidate : eligible;

  // Heavy items prefer low shelves (ergonomics + safety); ties break on
  // least-full, then position.
  const chosen =
    pool.length > 0
      ? [...pool].sort((a, b) => {
          if (weightClass === "pesado") {
            const dl = (levels.get(a.id) ?? 1) - (levels.get(b.id) ?? 1);
            if (dl !== 0) return dl;
          }
          return (
            a.used / a.capacity - b.used / b.capacity || a.position - b.position
          );
        })[0]
      : null;

  // The strip shows the bins of the chosen bin's station (or, if none eligible,
  // any station in the required zone so the operator still sees the zone state).
  const stationId =
    chosen?.station_id ?? inZone[0]?.station_id ?? null;
  const strip: BinStripCell[] = bins
    .filter((b) => b.station_id === stationId)
    .sort((a, b) => a.position - b.position)
    .map((b) => {
      const pct = pctOf(b.used, b.capacity);
      let color: BinStripColor;
      if (chosen && b.id === chosen.id) color = "suggested";
      else if (pct >= FULL_PCT || !b.active) color = "full";
      else if (pct >= FILLING_PCT) color = "filling";
      else color = "free";
      return {
        id: b.id,
        code: b.code,
        position: b.position,
        level: levels.get(b.id) ?? 1,
        pct,
        color,
      };
    });

  return {
    zone,
    binId: chosen?.id ?? null,
    binCode: chosen?.code ?? null,
    binLevel: chosen ? (levels.get(chosen.id) ?? 1) : null,
    binPosition: chosen?.position ?? null,
    stationId,
    stationName: chosen?.station_name ?? null,
    strip,
    reason: chosen
      ? `Zona ${zone} · bin ${chosen.code}${consolidate.length ? " (consolida mismo producto)" : ""}`
      : `Sin bin libre en zona ${zone}`,
  };
}
