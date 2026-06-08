// /stow — Amazon-style stow station (operator, manager, owner).
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StowClient } from "@/components/stow/StowClient";
import type { Zone } from "@/lib/types";
import type { BinStripCell } from "@/lib/rules/putaway";

export const dynamic = "force-dynamic";

export default async function StowPage() {
  const ctx = await requireRole("operator", "manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  const [{ data: stations }, { data: bins }, { data: occ }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, zone")
      .eq("warehouse_id", wh)
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("bins")
      .select("id, station_id, code, position, zone, capacity")
      .eq("warehouse_id", wh)
      .eq("active", true),
    supabase.from("bin_occupancy").select("bin_id, used").eq("warehouse_id", wh),
  ]);

  // Pre-build the occupancy strip per station so the strip is always visible.
  const usedMap = new Map((occ ?? []).map((o) => [o.bin_id, o.used]));
  const stationStrips: Record<string, BinStripCell[]> = {};
  for (const b of bins ?? []) {
    const pct = b.capacity
      ? Math.round((100 * (usedMap.get(b.id) ?? 0)) / b.capacity)
      : 0;
    const color: BinStripCell["color"] =
      pct >= 100 ? "full" : pct >= 70 ? "filling" : "free";
    (stationStrips[b.station_id] ??= []).push({
      id: b.id,
      code: b.code,
      position: b.position,
      pct,
      color,
    });
  }
  for (const k of Object.keys(stationStrips)) {
    stationStrips[k].sort((a, b) => a.position - b.position);
  }

  return (
    <StowClient
      stations={(stations ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        zone: s.zone as Zone,
      }))}
      stationStrips={stationStrips}
    />
  );
}
