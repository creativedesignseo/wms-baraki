// /approval — manager queue (manager, owner). Lists products pending review.
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApprovalClient } from "@/components/approval/ApprovalClient";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ApprovalPage() {
  const ctx = await requireRole("manager", "owner");
  const supabase = await createClient();

  const [{ data: products }, { data: warehouse }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("warehouse_id", ctx.profile.warehouse_id)
      .eq("review_status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("warehouses")
      .select("currency_local, exchange_rate_usd")
      .eq("id", ctx.profile.warehouse_id)
      .maybeSingle(),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">
        Cola de aprobación
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Revisa el precio y los datos antes de aprobar. El precio local se calcula
        con la tasa actual ({warehouse?.exchange_rate_usd ?? 1}{" "}
        {warehouse?.currency_local ?? "USD"}/USD).
      </p>
      <ApprovalClient
        initialProducts={(products as Product[]) ?? []}
        rate={warehouse?.exchange_rate_usd ?? 1}
        currency={warehouse?.currency_local ?? "USD"}
      />
    </div>
  );
}
