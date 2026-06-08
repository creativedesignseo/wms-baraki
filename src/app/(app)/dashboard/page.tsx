// /dashboard — management panel (manager, owner). Amazon-style ops metrics.
import { Trophy } from "lucide-react";
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

  // ── items stowed today + per-operator ───────────────────────────────────────
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

  // ── bin occupancy by zone ───────────────────────────────────────────────────
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

  // ── FEFO alerts ──────────────────────────────────────────────────────────────
  let rojo = 0;
  let amarillo = 0;
  for (const b of expBatches ?? []) {
    const lvl = fefoLevel(b.expiration_date);
    if (lvl === "rojo") rojo += 1;
    else if (lvl === "amarillo") amarillo += 1;
  }

  // bins grouped by station (for the manager)
  const binsByStation = new Map<string, number>();
  const usedByStation = new Map<string, number>();
  const capByStation = new Map<string, number>();
  for (const b of bins ?? []) {
    binsByStation.set(b.station_id, (binsByStation.get(b.station_id) ?? 0) + 1);
    usedByStation.set(b.station_id, (usedByStation.get(b.station_id) ?? 0) + (usedMap.get(b.id) ?? 0));
    capByStation.set(b.station_id, (capByStation.get(b.station_id) ?? 0) + b.capacity);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Panel de operación</h1>

      {/* top metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Ítems hoy" value={itemsToday} />
        <Metric label="Operarios activos hoy" value={operators.length} />
        <Metric
          label="Pendientes de aprobar"
          value={pendingCount ?? 0}
          tone={pendingCount ? "amber" : "default"}
        />
        <Metric
          label="Caducidad crítica"
          value={rojo}
          sub={`${amarillo} próximas`}
          tone={rojo ? "red" : "default"}
        />
      </div>

      {/* occupancy by zone */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Ocupación de bins por zona</h2>
        <div className="space-y-3">
          {ZONES.filter((z) => zoneStats.has(z)).map((z) => {
            const s = zoneStats.get(z)!;
            const pct = s.cap ? Math.round((100 * s.used) / s.cap) : 0;
            return (
              <div key={z}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{ZONE_LABEL[z]}</span>
                  <span className="text-slate-500">
                    {s.used}/{s.cap} u · {pct}% · {s.full}/{s.bins} bins llenos
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {zoneStats.size === 0 && (
            <p className="text-sm text-slate-400">No hay bins todavía. Crea una estación abajo.</p>
          )}
        </div>
      </section>

      {/* operator rates */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Productividad hoy (por operario)</h2>
        {operators.length === 0 ? (
          <p className="text-sm text-slate-400">Sin actividad hoy.</p>
        ) : (
          <ul className="space-y-2">
            {operators.map((o, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-700">
                  {i === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                  {o.name}
                </span>
                <span className="font-semibold text-slate-900">
                  {o.qty} u <span className="font-normal text-slate-400">/ {o.lines} líneas</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "default" | "amber" | "red";
}) {
  const toneCls =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
