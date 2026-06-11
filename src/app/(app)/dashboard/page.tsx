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
import { inferZone, resolveLevels, type BinForStow, type BinStripCell } from "@/lib/rules/putaway";
import { levelMeta } from "@/lib/levels";
import { StationsManager } from "@/components/dashboard/StationsManager";
import { BinWall } from "@/components/stow/BinWall";
import { ArrowRight, LayoutGrid, QrCode, History } from "lucide-react";
import Link from "next/link";
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
    { data: placedBatches },
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
      .select("id, station_id, code, position, zone, level, capacity")
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
    // active placed batches → zone mismatch detection (relocation alerts)
    supabase
      .from("batches")
      .select("quantity, products(name, category), bins!inner(code, zone, level)")
      .eq("warehouse_id", wh)
      .eq("status", "activo")
      .not("bin_id", "is", null)
      .limit(300),
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

  // Outbound audit trail (table exists after migration 0009; hide card before).
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("id, product_name, barcode, bin_code, quantity, reason, operator_name, created_at")
    .eq("warehouse_id", wh)
    .order("created_at", { ascending: false })
    .limit(12);

  // The full location wall, grouped by zone — a manager's situational overview
  // (it used to clutter the operator's stow screen; now it lives here).
  const forStow: BinForStow[] = (bins ?? []).map((b) => ({
    id: b.id,
    station_id: b.station_id,
    station_name: "",
    code: b.code,
    position: b.position,
    level: b.level ?? null,
    zone: b.zone as Zone,
    capacity: b.capacity,
    used: usedMap.get(b.id) ?? 0,
    active: true,
  }));
  const wallLevels = resolveLevels(forStow);
  const wallByZone: Record<string, BinStripCell[]> = {};
  for (const b of forStow) {
    const pct = b.capacity ? Math.round((100 * b.used) / b.capacity) : 100;
    const color: BinStripCell["color"] = pct >= 100 ? "full" : pct >= 70 ? "filling" : "free";
    (wallByZone[b.zone] ??= []).push({
      id: b.id,
      code: b.code,
      position: b.position,
      level: wallLevels.get(b.id) ?? 1,
      pct,
      color,
    });
  }
  for (const k of Object.keys(wallByZone)) {
    wallByZone[k].sort((a, b) => a.position - b.position);
  }
  const wallZones = ZONES.filter((z) => wallByZone[z]?.length);

  // Relocation alerts: a batch whose product category implies a different
  // temperature zone than the bin it physically sits in (e.g. butter in
  // Ambiente). Only flags products with a known category.
  interface Reloc {
    name: string;
    quantity: number;
    binCode: string;
    level: number;
    from: Zone;
    to: Zone;
  }
  const relocations: Reloc[] = [];
  for (const b of placedBatches ?? []) {
    const prod = (Array.isArray(b.products) ? b.products[0] : b.products) as
      | { name: string | null; category: string | null }
      | null;
    const bin = (Array.isArray(b.bins) ? b.bins[0] : b.bins) as
      | { code: string; zone: Zone; level: number | null }
      | null;
    if (!prod?.category || !bin) continue;
    const target = inferZone(prod.category, false);
    if (target !== bin.zone) {
      relocations.push({
        name: prod.name ?? "(sin nombre)",
        quantity: b.quantity,
        binCode: bin.code,
        level: bin.level ?? 1,
        from: bin.zone,
        to: target,
      });
    }
  }

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
                  No hay ubicaciones todavía. Crea una estación abajo.
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

        {/* relocation alerts: products sitting in the wrong temperature zone */}
        <section
          className="deck-rise rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          style={{ animationDelay: "150ms" }}
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <AlertTriangle
                className={`h-4 w-4 ${relocations.length ? "text-amber-500" : "text-zinc-400"}`}
                strokeWidth={1.8}
              />
              Reubicaciones sugeridas
            </h2>
            {relocations.length > 0 && (
              <span
                className={`rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 ${NUM}`}
              >
                {relocations.length}
              </span>
            )}
          </header>
          {relocations.length === 0 ? (
            <div className="p-5">
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
                <Boxes className="mx-auto mb-2 h-6 w-6 text-zinc-300" strokeWidth={1.8} />
                Todo está en su zona correcta.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {relocations.map((r, i) => {
                const meta = levelMeta(r.level);
                return (
                  <li
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-3 transition hover:bg-zinc-50"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="truncate text-sm font-medium text-ink">{r.name}</span>
                      <span className={`shrink-0 text-xs text-zinc-400 ${NUM}`}>×{r.quantity}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${NUM}`}
                        style={{ backgroundColor: meta.color, color: meta.text }}
                      >
                        {r.binCode}
                      </span>
                      <span className="text-xs text-zinc-400">{ZONE_LABEL[r.from]}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />
                      <span className="text-xs font-semibold text-amber-700">{ZONE_LABEL[r.to]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* outbound movements — the audit trail (who/when/what/where) */}
        {movements && movements.length > 0 && (
          <section
            className="deck-rise rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            style={{ animationDelay: "155ms" }}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <History className="h-4 w-4 text-zinc-400" strokeWidth={1.8} />
                Movimientos recientes
              </h2>
              <span className={`text-[11px] text-zinc-400 ${NUM}`}>retiros · auditoría</span>
            </header>
            <ul className="divide-y divide-line">
              {movements.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm transition hover:bg-zinc-50"
                >
                  <span className={`shrink-0 text-xs text-zinc-400 ${NUM}`}>
                    {new Date(m.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                    })}{" "}
                    {new Date(m.created_at).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">
                    {m.product_name || m.barcode || "(sin nombre)"}
                  </span>
                  <span className={`shrink-0 text-sm font-bold text-ink ${NUM}`}>
                    −{m.quantity}
                  </span>
                  {m.bin_code && (
                    <span className={`shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 ${NUM}`}>
                      {m.bin_code}
                    </span>
                  )}
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {m.reason ?? "—"}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {m.operator_name ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* full location wall by zone — manager situational overview */}
        {wallZones.length > 0 && (
          <section
            className="deck-rise rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            style={{ animationDelay: "165ms" }}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <LayoutGrid className="h-4 w-4 text-zinc-400" strokeWidth={1.8} />
                Estantería por zona
              </h2>
              <Link
                href="/dashboard/labels"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <QrCode className="h-3.5 w-3.5" /> Etiquetas QR
              </Link>
            </header>
            <div className="space-y-6 p-5">
              {wallZones.map((z) => (
                <div key={z}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${ZONE_DOT[z]}`} />
                    <span className="text-sm font-semibold text-ink">{ZONE_LABEL[z]}</span>
                    <span className={`text-xs text-zinc-400 ${NUM}`}>
                      {wallByZone[z].length} ubic.
                    </span>
                  </div>
                  <BinWall cells={wallByZone[z]} />
                </div>
              ))}
            </div>
          </section>
        )}

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
