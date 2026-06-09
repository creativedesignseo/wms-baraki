"use client";

// Fast quantity entry for warehouse use: big +1/+5/+10 buttons and a reset.
// variant "dark" suits the command-deck stow station; "light" the rest.
export function QuickNumPad({
  value,
  onChange,
  variant = "light",
}: {
  value: number;
  onChange: (n: number) => void;
  variant?: "light" | "dark";
}) {
  const bump = (n: number) => onChange(Math.max(1, value + n));
  const dark = variant === "dark";

  const stepBtn = dark
    ? "h-12 w-12 rounded-lg border border-white/15 text-xl font-bold text-slate-100 active:bg-white/10"
    : "h-12 w-12 rounded-lg border border-slate-300 text-xl font-bold text-slate-700 active:bg-slate-100";
  const input = dark
    ? "h-12 w-24 rounded-lg border border-white/15 bg-white/5 text-center font-[family-name:var(--font-num)] text-2xl font-bold text-white outline-none focus:border-lime-400"
    : "h-12 w-24 rounded-lg border border-slate-300 text-center text-2xl font-bold text-slate-900 outline-none focus:border-slate-900";
  const quickBtn = dark
    ? "flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white active:bg-white/20"
    : "flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white active:bg-slate-700";
  const resetBtn = dark
    ? "flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-400 active:bg-white/10"
    : "flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 active:bg-slate-100";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => bump(-1)} className={stepBtn} aria-label="Restar 1">
          −
        </button>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
          className={input}
        />
        <button type="button" onClick={() => bump(1)} className={stepBtn} aria-label="Sumar 1">
          +
        </button>
      </div>
      <div className="flex gap-2">
        {[1, 5, 10].map((n) => (
          <button key={n} type="button" onClick={() => bump(n)} className={quickBtn}>
            +{n}
          </button>
        ))}
        <button type="button" onClick={() => onChange(1)} className={resetBtn}>
          Reset
        </button>
      </div>
    </div>
  );
}
