// /stow — Amazon-style stow station (operator, manager, owner).
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StowClient } from "@/components/stow/StowClient";
import type { Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StowPage() {
  const ctx = await requireRole("operator", "manager", "owner");
  const supabase = await createClient();

  const { data: stations } = await supabase
    .from("stations")
    .select("id, name, zone")
    .eq("warehouse_id", ctx.profile.warehouse_id)
    .eq("active", true)
    .order("name", { ascending: true });

  return (
    <StowClient
      stations={(stations ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        zone: s.zone as Zone,
      }))}
    />
  );
}
