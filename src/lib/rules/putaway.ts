// Putaway rules engine — deterministic, pure, testable.
// Given a product + batch hints and the warehouse's locations, suggest the best
// location by zone (temperature/hazmat), weight class and level.
//
// Never writes weight back to the product. Weight here is only a placement hint;
// when unknown we assume "ligero" for shelving purposes (not stored).

import type { Location, Zone, WeightClass, Level } from "@/lib/types";

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
