// FEFO semáforo badge for a batch expiration date.
import { daysUntil, fefoLevel } from "@/lib/fefo";

const STYLES: Record<string, string> = {
  verde: "bg-green-100 text-green-800",
  amarillo: "bg-amber-100 text-amber-800",
  rojo: "bg-red-100 text-red-800",
  none: "bg-slate-100 text-slate-500",
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[level]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
