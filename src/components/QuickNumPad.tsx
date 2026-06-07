"use client";

// Fast quantity entry for warehouse use: big +1/+5/+10 buttons and a reset.
export function QuickNumPad({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const bump = (n: number) => onChange(Math.max(1, value + n));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          className="h-12 w-12 rounded-lg border border-slate-300 text-xl font-bold text-slate-700 active:bg-slate-100"
          aria-label="Restar 1"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
          className="h-12 w-24 rounded-lg border border-slate-300 text-center text-2xl font-bold text-slate-900 outline-none focus:border-slate-900"
        />
        <button
          type="button"
          onClick={() => bump(1)}
          className="h-12 w-12 rounded-lg border border-slate-300 text-xl font-bold text-slate-700 active:bg-slate-100"
          aria-label="Sumar 1"
        >
          +
        </button>
      </div>
      <div className="flex gap-2">
        {[1, 5, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => bump(n)}
            className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white active:bg-slate-700"
          >
            +{n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(1)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 active:bg-slate-100"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
