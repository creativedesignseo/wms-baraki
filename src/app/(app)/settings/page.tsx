// /settings — warehouse settings (owner only).
import { Warehouse } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireRole("owner");
  const supabase = await createClient();
  // select("*") so default_margin_pct comes through even before migration 0011.
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("*")
    .eq("id", ctx.profile.warehouse_id)
    .single();

  return (
    <div className="flex-1 px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-2xl lg:mx-0">
        <header className="deck-rise mb-6">
          <div className="font-[family-name:var(--font-num)] text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Configuración
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            Ajustes del almacén
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Nombre, moneda local, tasa de cambio y margen de venta por defecto.
          </p>
        </header>

        {warehouse ? (
          <SettingsClient
            id={warehouse.id}
            name={warehouse.name}
            currency={warehouse.currency_local}
            rate={warehouse.exchange_rate_usd}
            margin={warehouse.default_margin_pct ?? 30}
          />
        ) : (
          <div
            className="deck-rise rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400"
            style={{ animationDelay: "60ms" }}
          >
            <Warehouse className="mx-auto mb-3 h-6 w-6 text-zinc-300" strokeWidth={1.8} />
            No se encontró el almacén.
          </div>
        )}
      </div>
    </div>
  );
}
