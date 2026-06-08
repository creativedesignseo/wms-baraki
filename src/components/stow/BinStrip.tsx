"use client";

import type { BinStripCell } from "@/lib/rules/putaway";

// Amazon-style color-coded bin strip. Big, kiosk-friendly cells. The
// suggested/selected bin glows green; others show their occupancy. When
// onSelect is provided, non-full cells are tappable to override the target.
function occClass(color: BinStripCell["color"]): string {
  switch (color) {
    case "full":
      return "bg-red-200 text-red-900 border-red-300";
    case "filling":
      return "bg-amber-200 text-amber-900 border-amber-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
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
    return (
      <p className="text-sm text-slate-400">Esta estación no tiene bins activos.</p>
    );
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {cells.map((c) => {
        const selected = c.id === selectedBinId;
        const isFull = c.color === "full";
        const cls = selected
          ? "bg-green-500 text-white border-green-400 ring-2 ring-green-300 scale-105"
          : occClass(c.color);
        const clickable = Boolean(onSelect) && (!isFull || selected);
        return (
          <button
            key={c.id}
            type="button"
            disabled={!clickable}
            onClick={() => onSelect?.(c.id)}
            title={`${c.code} · ${c.pct}%`}
            className={`flex h-[4.5rem] w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 font-semibold transition ${cls} ${
              clickable ? "active:scale-95" : "cursor-default"
            } ${isFull && !selected ? "opacity-70" : ""}`}
          >
            <span className="text-2xl leading-none">{c.position}</span>
            <span className="mt-1 text-[11px] opacity-80">{c.pct}%</span>
          </button>
        );
      })}
    </div>
  );
}
