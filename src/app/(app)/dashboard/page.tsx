// /dashboard — management panel (manager, owner). Industrial Precision console.
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
const ZONE_DOT: Record<Zone, string> = {
  general: "bg-zinc-400",
  refrigerado: "bg-cyan-500",
  congelado: "bg-blue-600",
  hazmat: "bg-amber-500",
};

const NUM = "font-[family-name:var(--font-num)] tabular-nums";

export default async function DashboardPage() {
  const ctx = await requireRole("manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = dayStart.toISOString();

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
  const linesToday = (todayBatches ?? []).length;
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

  // throughput rate: units stowed per elapsed hour since 00:00 (min 1h window)
  const hoursElapsed = Math.max(1, (now.getTime() - dayStart.getTime()) / 3_600_000);
  const rateStr = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(
    itemsToday / hoursElapsed,
  );

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
  let totalCap = 0;
  let totalUsed = 0;
  for (const s of zoneStats.values()) {
    totalCap += s.cap;
    totalUsed += s.used;
  }
  const occPct = totalCap ? Math.round((100 * totalUsed) / totalCap) : 0;

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
    <div className="flex-1 px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* page header */}
        <div className="deck-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <div
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}
            >
              Centro de mando
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
              Panel de operación
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Actividad de hoy y estado del almacén.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              pendingCount
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />
            <span className={NUM}>{pendingCount ?? 0}</span> pendientes de revisión
          </span>
        </div>

        {/* KPI row */}
        <div className="deck-rise grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" style={{ animationDelay: "60ms" }}>
          <Metric
            label="Ítems hoy"
            value={itemsToday}
            caption={`${linesToday} líneas · ${operators.length} operarios`}
            icon={Package}
          />
          <Metric label="Tasa/h" value={rateStr} caption="unidades por hora hoy" icon={Gauge} />
          <Metric
            label="Ocupación"
            value={`${occPct}%`}
            caption={`${totalUsed}/${totalCap} unidades`}
            icon={Boxes}
          />
          <Metric
            label="FEFO en riesgo"
            value={rojo}
            caption={`${amarillo} próximas a caducar`}
            icon={AlertTriangle}
            tone={rojo ? "red" : "default"}
          />
        </div>

        <div
          className="deck-rise grid items-start gap-4 lg:grid-cols-2"
          style={{ animationDelay: "120ms" }}
        >
          {/* occupancy by zone */}
          <section className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Boxes className="h-4 w-4 text-zinc-400" strokeWidth={1.8} />
                Ocupación por zona
              </h2>
              <span className={`text-[11px] text-zinc-400 ${NUM}`}>
                {totalUsed}/{totalCap} u
              </span>
            </header>
            <div className="p-5">
              {occupiedZones.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400">
                  <Boxes className="mx-auto mb-2 h-6 w-6 text-zinc-300" strokeWidth={1.8} />
                  No hay bins todavía. Crea una estación abajo.
                </div>
              ) : (
                <div className="space-y-4">
                  {occupiedZones.map((z) => {
                    const s = zoneStats.get(z)!;
                    const pct = s.cap ? Math.round((100 * s.used) / s.cap) : 0;
                    const fill =
                      pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-ink";
                    return (
                      <div key={z}>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-sm font-medium text-ink">
                            <span className={`h-2 w-2 rounded-full ${ZONE_DOT[z]}`} />
                            {ZONE_LABEL[z]}
                          </span>
                          <span className={`text-xs text-zinc-400 ${NUM}`}>
                            {s.used}/{s.cap} u · {s.full}/{s.bins} llenos
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full ${fill} transition-all`}
                              style={{
                                width: `${pct === 0 ? 0 : Math.min(100, Math.max(2, pct))}%`,
                              }}
                            />
                          </div>
                          <span className={`w-10 text-right text-sm font-semibold text-ink ${NUM}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* operator leaderboard */}
          <section className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Trophy className="h-4 w-4 text-zinc-400" strokeWidth={1.8} />
                Productividad hoy
              </h2>
              <span className={`text-[11px] text-zinc-400 ${NUM}`}>
                {operators.length} operarios
              </span>
            </header>
            {operators.length === 0 ? (
              <div className="p-5">
                <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400">
                  <Users className="mx-auto mb-2 h-6 w-6 text-zinc-300" strokeWidth={1.8} />
                  Sin actividad hoy.
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {operators.map((o, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-zinc-50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${NUM} ${
                          i === 0
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="truncate text-sm font-medium text-ink">{o.name}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold text-ink ${NUM}`}>
                      {o.qty} u <span className="font-normal text-zinc-400">/ {o.lines}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* stations + bins management */}
        <div className="deck-rise" style={{ animationDelay: "180ms" }}>
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
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  caption,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  caption?: string;
  tone?: "default" | "red";
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}
        >
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.8} />
      </div>
      <div
        className={`mt-2 text-3xl font-bold ${NUM} ${
          tone === "red" ? "text-red-600" : "text-ink"
        }`}
      >
        {value}
      </div>
      {caption && <div className="mt-1 text-xs text-zinc-400">{caption}</div>}
    </div>
  );
}
