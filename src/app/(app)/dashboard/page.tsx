// /dashboard — management panel (manager, owner). Light ops monitor.
import type { LucideIcon } from "lucide-react";
import {
  Trophy,
  Package,
  Users,
  ClipboardCheck,
  AlertTriangle,
  Boxes,
  Gauge,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fefoLevel } from "@/lib/fefo";
import { StationsManager } from "@/components/dashboard/StationsManager";
import type { Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

const ZONES: Zone[] = ["general", "refrigerado", "congelado", "hazmat"];
const ZONE_LABEL: Record<Zone, string> = {
  general: "Ambiente",
  refrigerado: "Refrigerado",
  congelado: "Congelado",
  hazmat: "Hazmat",
};

const NUM = "font-[family-name:var(--font-num)] tabular-nums";
const DISPLAY = "font-[family-name:var(--font-display)]";

export default async function DashboardPage() {
  const ctx = await requireRole("manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();

  const [
    { data: todayBatches },
    { count: pendingCount },
    { data: bins },
    { data: occ },
    { data: expBatches },
    { data: stations },
  ] = await Promise.all([
    supabase
      .from("batches")
      .select("operator_id, quantity, created_at")
      .eq("warehouse_id", wh)
      .gte("created_at", startOfDay),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("warehouse_id", wh)
      .eq("review_status", "pending"),
    supabase
      .from("bins")
      .select("id, station_id, zone, capacity")
      .eq("warehouse_id", wh)
      .eq("active", true),
    supabase.from("bin_occupancy").select("bin_id, used").eq("warehouse_id", wh),
    supabase
      .from("batches")
      .select("expiration_date")
      .eq("warehouse_id", wh)
      .eq("status", "activo")
      .not("expiration_date", "is", null),
    supabase
      .from("stations")
      .select("id, name, zone, active")
      .eq("warehouse_id", wh)
      .order("name", { ascending: true }),
  ]);

  const itemsToday = (todayBatches ?? []).reduce((s, b) => s + b.quantity, 0);
  const perOp = new Map<string, { qty: number; lines: number }>();
  for (const b of todayBatches ?? []) {
    const cur = perOp.get(b.operator_id) ?? { qty: 0, lines: 0 };
    cur.qty += b.quantity;
    cur.lines += 1;
    perOp.set(b.operator_id, cur);
  }
  const opIds = [...perOp.keys()];
  const opNames = new Map<string, string>();
  if (opIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", opIds);
    for (const p of profs ?? []) opNames.set(p.id, p.full_name ?? "—");
  }
  const operators = [...perOp.entries()]
    .map(([id, v]) => ({ name: opNames.get(id) ?? "—", ...v }))
    .sort((a, b) => b.qty - a.qty);

  const usedMap = new Map((occ ?? []).map((o) => [o.bin_id, o.used]));
  const zoneStats = new Map<Zone, { cap: number; used: number; bins: number; full: number }>();
  for (const b of bins ?? []) {
    const z = b.zone as Zone;
    const used = usedMap.get(b.id) ?? 0;
    const cur = zoneStats.get(z) ?? { cap: 0, used: 0, bins: 0, full: 0 };
    cur.cap += b.capacity;
    cur.used += used;
    cur.bins += 1;
    if (used >= b.capacity) cur.full += 1;
    zoneStats.set(z, cur);
  }

  let rojo = 0;
  let amarillo = 0;
  for (const b of expBatches ?? []) {
    const lvl = fefoLevel(b.expiration_date);
    if (lvl === "rojo") rojo += 1;
    else if (lvl === "amarillo") amarillo += 1;
  }

  const binsByStation = new Map<string, number>();
  const usedByStation = new Map<string, number>();
  const capByStation = new Map<string, number>();
  for (const b of bins ?? []) {
    binsByStation.set(b.station_id, (binsByStation.get(b.station_id) ?? 0) + 1);
    usedByStation.set(b.station_id, (usedByStation.get(b.station_id) ?? 0) + (usedMap.get(b.id) ?? 0));
    capByStation.set(b.station_id, (capByStation.get(b.station_id) ?? 0) + b.capacity);
  }

  const occupiedZones = ZONES.filter((z) => zoneStats.has(z));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Gauge className="h-5 w-5" />
        </span>
        <h1 className={`text-2xl font-extrabold tracking-tight text-slate-900 ${DISPLAY}`}>
          Panel de operación
        </h1>
      </div>

      {/* metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Ítems hoy" value={itemsToday} icon={Package} />
        <Metric label="Operarios hoy" value={operators.length} icon={Users} />
        <Metric
          label="Pendientes"
          value={pendingCount ?? 0}
          icon={ClipboardCheck}
          tone={pendingCount ? "amber" : "default"}
        />
        <Metric
          label="Caducidad crítica"
          value={rojo}
          sub={`${amarillo} próximas`}
          icon={AlertTriangle}
          tone={rojo ? "red" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* occupancy */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Boxes className="h-4 w-4 text-slate-400" /> Ocupación de bins por zona
          </h2>
          {occupiedZones.length === 0 ? (
            <p className="text-sm text-slate-400">No hay bins todavía. Crea una estación abajo.</p>
          ) : (
            <div className="space-y-4">
              {occupiedZones.map((z) => {
                const s = zoneStats.get(z)!;
                const pct = s.cap ? Math.round((100 * s.used) / s.cap) : 0;
                const fill =
                  pct >= 90
                    ? "from-red-500 to-red-400"
                    : pct >= 70
                      ? "from-amber-500 to-amber-300"
                      : "from-green-500 to-green-400";
                return (
                  <div key={z}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{ZONE_LABEL[z]}</span>
                      <span className={`text-xs text-slate-400 ${NUM}`}>
                        {s.used}/{s.cap} · {s.full}/{s.bins} llenos
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${fill}`}
                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                        />
                      </div>
                      <span className={`w-11 text-right text-sm font-bold text-slate-900 ${NUM}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* leaderboard */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Trophy className="h-4 w-4 text-slate-400" /> Productividad hoy
          </h2>
          {operators.length === 0 ? (
            <p className="text-sm text-slate-400">Sin actividad hoy.</p>
          ) : (
            <ul className="space-y-1.5">
              {operators.map((o, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 odd:bg-slate-50"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${NUM} ${
                        i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium text-slate-800">{o.name}</span>
                  </span>
                  <span className={`text-sm font-semibold text-slate-900 ${NUM}`}>
                    {o.qty} u <span className="font-normal text-slate-400">/ {o.lines}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* stations + bins management */}
      <StationsManager
        warehouseId={wh}
        stations={(stations ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          zone: s.zone as Zone,
          active: s.active,
          binCount: binsByStation.get(s.id) ?? 0,
          used: usedByStation.get(s.id) ?? 0,
          capacity: capByStation.get(s.id) ?? 0,
        }))}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "default" | "amber" | "red";
  icon: LucideIcon;
}) {
  const t = {
    default: { value: "text-slate-900", chip: "bg-slate-100 text-slate-500" },
    amber: { value: "text-amber-600", chip: "bg-amber-100 text-amber-600" },
    red: { value: "text-red-600", chip: "bg-red-100 text-red-600" },
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.chip}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-2 text-4xl font-bold ${NUM} ${t.value}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
