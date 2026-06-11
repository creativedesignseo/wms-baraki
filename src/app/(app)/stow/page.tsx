// /stow — stow station (operator, manager, owner). Zone-driven (Ambiente by
// default; operator switches to cold zones for perishables). The wall renders
// bins as the physical shelf elevation: rows = levels, color = level (LaceUp).
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StowClient } from "@/components/stow/StowClient";
import { resolveLevels, type BinForStow, type BinStripCell } from "@/lib/rules/putaway";
import type { Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

const ZONE_ORDER: Zone[] = ["general", "refrigerado", "congelado", "hazmat"];

export default async function StowPage() {
  const ctx = await requireRole("operator", "manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  // select("*") keeps this working before AND after migration 0007 adds `level`.
  const [{ data: bins }, { data: occ }] = await Promise.all([
    supabase.from("bins").select("*").eq("warehouse_id", wh).eq("active", true),
    supabase.from("bin_occupancy").select("bin_id, used").eq("warehouse_id", wh),
  ]);

  const usedMap = new Map((occ ?? []).map((o) => [o.bin_id, o.used]));
  const forStow: BinForStow[] = (bins ?? []).map((b) => ({
    id: b.id,
    station_id: b.station_id,
    station_name: "",
    code: b.code,
    position: b.position,
    level: b.level ?? null,
    zone: b.zone,
    capacity: b.capacity,
    used: usedMap.get(b.id) ?? 0,
    active: b.active,
  }));
  const levels = resolveLevels(forStow);

  const zoneStrips: Record<string, BinStripCell[]> = {};
  for (const b of forStow) {
    const pct = b.capacity ? Math.round((100 * b.used) / b.capacity) : 100;
    const color: BinStripCell["color"] =
      pct >= 100 ? "full" : pct >= 70 ? "filling" : "free";
    (zoneStrips[b.zone] ??= []).push({
      id: b.id,
      code: b.code,
      position: b.position,
      level: levels.get(b.id) ?? 1,
      pct,
      color,
    });
  }
  for (const k of Object.keys(zoneStrips)) {
    zoneStrips[k].sort((a, b) => a.position - b.position);
  }

  const zones = ZONE_ORDER.filter((z) => zoneStrips[z]?.length);

  return <StowClient zones={zones} zoneStrips={zoneStrips} />;
}
