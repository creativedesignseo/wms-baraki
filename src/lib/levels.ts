// Level system — LaceUp/Amazon model: COLOR = PHYSICAL SHELF HEIGHT.
// The on-screen color matches the colored label strip on the physical rack, so
// the operator knows from across the aisle whether to crouch, stand or climb.
// Baraki Valencia uses 3 levels (suelo/medio/alto); the palette scales to 5.

export interface LevelMeta {
  level: number;
  name: string; // human label, e.g. "Suelo"
  color: string; // bright label color (LaceUp palette)
  text: string; // readable text color on top of `color`
  soft: string; // tinted background for chips on white
  border: string; // border for soft chips
}

export const LEVEL_META: Record<number, LevelMeta> = {
  1: { level: 1, name: "Suelo", color: "#f2c40f", text: "#1c1503", soft: "#fbf3d2", border: "#ecd57a" },
  2: { level: 2, name: "Medio", color: "#9b59b6", text: "#ffffff", soft: "#f1e7f5", border: "#d3b3e0" },
  3: { level: 3, name: "Alto", color: "#2e86c1", text: "#ffffff", soft: "#e5f0f8", border: "#a9cce7" },
  4: { level: 4, name: "Nivel 4", color: "#27ae60", text: "#ffffff", soft: "#e4f5eb", border: "#a3dcbd" },
  5: { level: 5, name: "Nivel 5", color: "#e74c3c", text: "#ffffff", soft: "#fce9e7", border: "#f3b3ac" },
};

export function levelMeta(level: number | null | undefined): LevelMeta {
  const l = Math.min(5, Math.max(1, Math.round(level ?? 1)));
  return LEVEL_META[l];
}

/**
 * Fallback when the DB has no `level` column yet (pre-migration): band the
 * positions into 3 contiguous levels so the wall still reads like a shelf.
 * Once `bins.level` exists, the real value always wins.
 */
export function fallbackLevel(position: number, totalInGroup: number): number {
  if (totalInGroup <= 0) return 1;
  const perLevel = Math.ceil(totalInGroup / 3);
  return Math.min(3, Math.floor((position - 1) / perLevel) + 1);
}
