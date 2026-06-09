"use client";

import type { BinStripCell } from "@/lib/rules/putaway";

// Amazon-style color-coded bin strip (light theme). The suggested/selected bin
// glows green; others show occupancy. When onSelect is provided, non-full cells
// are tappable to override the target.
function occClass(color: BinStripCell["color"]): string {
  switch (color) {
    case "full":
      return "bg-red-100 text-red-800 border-red-200";
    case "filling":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export function BinStrip({
  cells,
  selectedBinId,
  onSelect,
}: {
  cells: BinStripCell[];
  selectedBinId?: string | null;
  onSelect?: (binId: string) => void;
}) {
  if (cells.length === 0) {
    return <p className="text-sm text-slate-400">Esta estación no tiene bins activos.</p>;
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {cells.map((c) => {
        const selected = c.id === selectedBinId;
        const isFull = c.color === "full";
        const cls = selected
          ? "bg-green-500 text-white border-green-400 ring-2 ring-green-200 scale-105"
          : occClass(c.color);
        const clickable = Boolean(onSelect) && (!isFull || selected);
        return (
          <button
            key={c.id}
            type="button"
            disabled={!clickable}
            onClick={() => onSelect?.(c.id)}
            title={`${c.code} · ${c.pct}%`}
            className={`flex h-[4.5rem] w-16 shrink-0 flex-col items-center justify-center rounded-xl border font-[family-name:var(--font-num)] transition ${cls} ${
              clickable ? "active:scale-95" : "cursor-default"
            } ${isFull && !selected ? "opacity-70" : ""}`}
          >
            <span className="text-2xl font-bold leading-none tabular-nums">{c.position}</span>
            <span className="mt-1 text-[11px] opacity-80">{c.pct}%</span>
          </button>
        );
      })}
    </div>
  );
}
