// /stow — stow station (operator, manager, owner). Zone-driven (Ambiente by
// default; operator switches to cold zones for perishables).
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StowClient } from "@/components/stow/StowClient";
import type { Zone } from "@/lib/types";
import type { BinStripCell } from "@/lib/rules/putaway";

export const dynamic = "force-dynamic";

const ZONE_ORDER: Zone[] = ["general", "refrigerado", "congelado", "hazmat"];

export default async function StowPage() {
  const ctx = await requireRole("operator", "manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  const [{ data: bins }, { data: occ }] = await Promise.all([
    supabase
      .from("bins")
      .select("id, code, position, zone, capacity")
      .eq("warehouse_id", wh)
      .eq("active", true),
    supabase.from("bin_occupancy").select("bin_id, used").eq("warehouse_id", wh),
  ]);

  const usedMap = new Map((occ ?? []).map((o) => [o.bin_id, o.used]));
  const zoneStrips: Record<string, BinStripCell[]> = {};
  for (const b of bins ?? []) {
    const pct = b.capacity
      ? Math.round((100 * (usedMap.get(b.id) ?? 0)) / b.capacity)
      : 0;
    const color: BinStripCell["color"] =
      pct >= 100 ? "full" : pct >= 70 ? "filling" : "free";
    (zoneStrips[b.zone] ??= []).push({
      id: b.id,
      code: b.code,
      position: b.position,
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
