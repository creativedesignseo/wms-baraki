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
    <div className="flex-1 px-4 py-6 lg:px-8 lg:py-7">
      <ApprovalClient
        initialProducts={(products as Product[]) ?? []}
        rate={warehouse?.exchange_rate_usd ?? 1}
        currency={warehouse?.currency_local ?? "USD"}
      />
    </div>
  );
}
