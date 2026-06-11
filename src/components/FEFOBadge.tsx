// FEFO semáforo badge for a batch expiration date.
import { daysUntil, fefoLevel } from "@/lib/fefo";

const STYLES: Record<string, string> = {
  verde: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  amarillo: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  rojo: "bg-red-50 text-red-700 ring-1 ring-red-200",
  none: "bg-zinc-100 text-zinc-600",
};

export function FEFOBadge({ expiration }: { expiration: string | null }) {
  const level = fefoLevel(expiration);
  const d = daysUntil(expiration);

  let label: string;
  if (level === "none") label = "Sin caducidad";
  else if (d !== null && d < 0) label = `Caducado (${Math.abs(d)}d)`;
  else label = `${d}d`;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-[family-name:var(--font-num)] text-[11px] font-semibold tabular-nums ${STYLES[level]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
