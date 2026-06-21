// /stow — "Guardar mercancía" (operator, manager, owner). The operator sees ONE
// clear order per scan; the full 18-location wall lives on the manager Panel.
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StowClient } from "@/components/stow/StowClient";
import type { Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

const ZONE_ORDER: Zone[] = ["general", "refrigerado", "congelado", "hazmat"];

export default async function StowPage() {
  const ctx = await requireRole("operator", "manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  // Which zones actually have active locations — drives the zone chooser.
  const { data: bins } = await supabase
    .from("bins")
    .select("zone")
    .eq("warehouse_id", wh)
    .eq("active", true);

  const present = new Set((bins ?? []).map((b) => b.zone));
  const zones = ZONE_ORDER.filter((z) => present.has(z));

  // Warehouse pricing context: currency + FX rate + default margin. select("*")
  // tolerates default_margin_pct not existing yet (pre-migration 0011 → fallback).
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("*")
    .eq("id", wh)
    .maybeSingle();
  const currency = warehouse?.currency_local ?? "USD";
  const rate = warehouse?.exchange_rate_usd ?? 1;
  const marginPct = warehouse?.default_margin_pct ?? 30;

  return (
    <StowClient zones={zones} currency={currency} rate={rate} marginPct={marginPct} />
  );
}
