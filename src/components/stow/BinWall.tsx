"use client";

import type { BinStripCell } from "@/lib/rules/putaway";
import { levelMeta } from "@/lib/levels";

// The Wall — the rack drawn as the operator sees it from the aisle.
// Rows are LEVELS (highest on top, suelo at the bottom), and each level wears
// its physical label color (LaceUp palette): the screen mirrors the shelf.
// Columns align across levels like real bays. The suggested bin pulses.

export function BinWall({
  cells,
  selectedBinId,
  onSelect,
  fill = false,
}: {
  cells: BinStripCell[];
  selectedBinId?: string | null;
  onSelect?: (binId: string) => void;
  /** Stretch level rows to fill the container height (workstation mode). */
  fill?: boolean;
}) {
  if (cells.length === 0) {
    return <p className="text-sm text-zinc-400">Esta zona no tiene bins activos.</p>;
  }

  // group by level, render top level first (physical elevation view)
  const byLevel = new Map<number, BinStripCell[]>();
  for (const c of cells) {
    (byLevel.get(c.level) ?? byLevel.set(c.level, []).get(c.level)!).push(c);
  }
  const levels = [...byLevel.keys()].sort((a, b) => b - a);
  const maxCols = Math.max(...levels.map((l) => byLevel.get(l)!.length));

  return (
    <div className={`flex flex-col gap-4 ${fill ? "flex-1" : ""}`}>
      {levels.map((lvl) => {
        const meta = levelMeta(lvl);
        const row = byLevel.get(lvl)!.sort((a, b) => a.position - b.position);
        return (
          <section key={lvl} className={`flex flex-col ${fill ? "flex-1" : ""}`}>
            {/* level label + beam */}
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: meta.color }}
              />
              <span className="font-[family-name:var(--font-num)] text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Nivel {lvl} · {meta.name}
              </span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-[family-name:var(--font-num)] text-[11px] text-zinc-400">
                {row.length} bins
              </span>
            </div>

            <div
              className={`grid gap-2 ${fill ? "flex-1" : ""}`}
              style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}
            >
              {row.map((c) => {
                const selected = c.id === selectedBinId;
                const isFull = c.color === "full";
                const clickable = Boolean(onSelect) && (!isFull || selected);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSelect?.(c.id)}
                    title={`${c.code} · nivel ${lvl} · ${c.pct}%`}
                    style={{ backgroundColor: meta.color, color: meta.text }}
                    className={`relative flex min-h-16 flex-col items-center justify-center overflow-hidden rounded-xl transition lg:min-h-20 ${
                      selected
                        ? "bin-pulse z-10 scale-[1.04] shadow-xl ring-4 ring-ink"
                        : "ring-1 ring-black/10"
                    } ${clickable ? "active:scale-95" : "cursor-default"} ${
                      isFull && !selected ? "opacity-30 saturate-50" : ""
                    }`}
                  >
                    <span className="font-[family-name:var(--font-num)] text-2xl font-bold leading-none tabular-nums lg:text-4xl">
                      {c.position}
                    </span>
                    {isFull && !selected && (
                      <span className="mt-1 font-[family-name:var(--font-num)] text-[9px] font-bold uppercase tracking-widest">
                        lleno
                      </span>
                    )}
                    {/* occupancy bar along the bottom edge */}
                    <span
                      className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: lvl === 1 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.28)" }}
                    >
                      <span
                        className="block h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, c.pct)}%`,
                          backgroundColor: lvl === 1 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.95)",
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
