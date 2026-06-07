// /settings — warehouse settings (owner only).
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireRole("owner");
  const supabase = await createClient();
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id, name, currency_local, exchange_rate_usd")
    .eq("id", ctx.profile.warehouse_id)
    .single();

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-slate-900">Ajustes del almacén</h1>
      {warehouse ? (
        <SettingsClient
          id={warehouse.id}
          name={warehouse.name}
          currency={warehouse.currency_local}
          rate={warehouse.exchange_rate_usd}
        />
      ) : (
        <p className="text-slate-500">No se encontró el almacén.</p>
      )}
    </div>
  );
}
