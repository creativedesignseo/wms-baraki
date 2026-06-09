// /dashboard — management panel (manager, owner). "Command deck" ops monitor.
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

  const occupiedZones = ZONES.filter((z) => zoneStats.has(z));

  return (
    <div className="space-y-5">
      {/* ── command deck (dark monitoring) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0a0e17] p-5 text-slate-200 shadow-2xl ring-1 ring-white/10 sm:p-7">
        {/* atmosphere: signal glow + faint grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(55% 110% at 100% 0%, rgba(163,230,53,0.13), transparent 60%), radial-gradient(45% 90% at 0% 0%, rgba(56,189,248,0.10), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />

        <div className="relative">
          {/* header */}
          <div className="deck-rise flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-lime-300/90">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
                </span>
                En vivo
              </div>
              <h1 className={`mt-1.5 text-3xl font-extrabold tracking-tight text-white ${DISPLAY}`}>
                Panel de operación
              </h1>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <Gauge className="h-5 w-5 text-white/50" />
            </span>
          </div>

          {/* metrics */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Ítems hoy" value={itemsToday} icon={Package} delay={0.05} />
            <Metric label="Operarios hoy" value={operators.length} icon={Users} delay={0.1} />
            <Metric
              label="Pendientes"
              value={pendingCount ?? 0}
              icon={ClipboardCheck}
              tone={pendingCount ? "amber" : "default"}
              delay={0.15}
            />
            <Metric
              label="Caducidad crítica"
              value={rojo}
              sub={`${amarillo} próximas`}
              icon={AlertTriangle}
              tone={rojo ? "red" : "default"}
              delay={0.2}
            />
          </div>

          {/* occupancy + leaderboard */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section
              className="deck-rise rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
              style={{ animationDelay: "0.25s" }}
            >
              <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Boxes className="h-4 w-4" /> Ocupación de bins por zona
              </h2>
              {occupiedZones.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay bins todavía. Crea una estación abajo.
                </p>
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
                          : "from-lime-500 to-lime-300";
                    return (
                      <div key={z}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-200">
                            {ZONE_LABEL[z]}
                          </span>
                          <span className={`text-xs text-slate-400 ${NUM}`}>
                            {s.used}/{s.cap} · {s.full}/{s.bins} llenos
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${fill}`}
                              style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                            />
                          </div>
                          <span className={`w-11 text-right text-sm font-bold text-white ${NUM}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section
              className="deck-rise rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
              style={{ animationDelay: "0.32s" }}
            >
              <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Trophy className="h-4 w-4" /> Productividad hoy
              </h2>
              {operators.length === 0 ? (
                <p className="text-sm text-slate-500">Sin actividad hoy.</p>
              ) : (
                <ul className="space-y-1.5">
                  {operators.map((o, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${NUM} ${
                            i === 0 ? "bg-lime-400 text-slate-900" : "bg-white/10 text-slate-300"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="font-medium text-slate-100">{o.name}</span>
                      </span>
                      <span className={`text-sm font-semibold text-white ${NUM}`}>
                        {o.qty} u <span className="text-slate-500">/ {o.lines}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* ── management (light) ── */}
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
  delay = 0,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "default" | "amber" | "red";
  icon: LucideIcon;
  delay?: number;
}) {
  const t = {
    default: { num: "text-white", chip: "bg-white/10 text-slate-300" },
    amber: { num: "text-amber-300", chip: "bg-amber-400/15 text-amber-300" },
    red: { num: "text-red-300", chip: "bg-red-400/15 text-red-300" },
  }[tone];
  return (
    <div
      className="deck-rise rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.chip}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-2 text-4xl font-bold ${NUM} ${t.num}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
