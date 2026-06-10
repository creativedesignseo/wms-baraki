"use client";

import type { BinStripCell } from "@/lib/rules/putaway";

// Amazon-style bin strip: each bin position gets a FIXED color along a rainbow
// (cool→warm) so the operator matches the on-screen number+color to the
// physical colored bin. The suggested/selected bin is emphasized; full bins are
// dimmed and not selectable. Occupancy shows as the small % under the number.

// Cyan (low index) → red (high index), matching Amazon's strip.
export function binHue(index: number, total: number): number {
  if (total <= 1) return 150;
  return Math.round(196 - (index / (total - 1)) * 196);
}
export function binColor(index: number, total: number): string {
  return `hsl(${binHue(index, total)}, 70%, 44%)`;
}

export function BinStrip({
  cells,
  selectedBinId,
  onSelect,
  fill = false,
}: {
  cells: BinStripCell[];
  selectedBinId?: string | null;
  onSelect?: (binId: string) => void;
  /** When true, the grid stretches rows to fill its container height. */
  fill?: boolean;
}) {
  if (cells.length === 0) {
    return <p className="text-sm text-slate-400">Esta estación no tiene bins activos.</p>;
  }
  const total = cells.length;

  return (
    <div
      className={`grid gap-3 ${fill ? "flex-1 [grid-auto-rows:1fr]" : ""}`}
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))" }}
    >
      {cells.map((c, i) => {
        const selected = c.id === selectedBinId;
        const isFull = c.color === "full";
        const clickable = Boolean(onSelect) && (!isFull || selected);
        return (
          <button
            key={c.id}
            type="button"
            disabled={!clickable}
            onClick={() => onSelect?.(c.id)}
            title={`${c.code} · ${c.pct}%`}
            style={{ backgroundColor: binColor(i, total) }}
            className={`relative flex min-h-[7rem] flex-col items-center justify-center rounded-2xl font-[family-name:var(--font-num)] text-white transition ${
              selected
                ? "z-10 scale-105 shadow-lg ring-4 ring-slate-900"
                : "ring-1 ring-black/10"
            } ${clickable ? "active:scale-95" : "cursor-default"} ${
              isFull && !selected ? "opacity-35 grayscale" : ""
            }`}
          >
            <span className="text-4xl font-bold leading-none tabular-nums drop-shadow">
              {c.position}
            </span>
            <span className="mt-1.5 text-xs font-medium opacity-90">{c.pct}%</span>
            {isFull && !selected && (
              <span className="absolute bottom-1.5 text-[9px] font-bold uppercase">lleno</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
