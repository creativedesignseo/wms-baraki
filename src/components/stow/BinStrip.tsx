"use client";

import type { BinStripCell } from "@/lib/rules/putaway";

// Amazon-style color-coded bin strip. The suggested/selected bin glows green;
// other bins show their occupancy (free / filling / full). Tap a non-full bin to
// override the target.
function occClass(color: BinStripCell["color"]): string {
  switch (color) {
    case "full":
      return "bg-red-200 text-red-900";
    case "filling":
      return "bg-amber-200 text-amber-900";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function BinStrip({
  cells,
  selectedBinId,
  onSelect,
}: {
  cells: BinStripCell[];
  selectedBinId: string | null;
  onSelect: (binId: string) => void;
}) {
  if (cells.length === 0) {
    return (
      <p className="text-sm text-slate-400">Esta estación no tiene bins activos.</p>
    );
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2">
      {cells.map((c) => {
        const selected = c.id === selectedBinId;
        const isFull = c.color === "full";
        return (
          <button
            key={c.id}
            type="button"
            disabled={isFull && !selected}
            onClick={() => onSelect(c.id)}
            title={`${c.code} · ${c.pct}%`}
            className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg font-semibold transition ${
              selected
                ? "scale-105 bg-green-500 text-white ring-2 ring-green-300"
                : occClass(c.color)
            } ${isFull && !selected ? "cursor-not-allowed opacity-60" : "active:scale-95"}`}
          >
            <span className="text-lg leading-none">{c.position}</span>
            <span className="mt-1 text-[10px] opacity-80">{c.pct}%</span>
          </button>
        );
      })}
    </div>
  );
}
