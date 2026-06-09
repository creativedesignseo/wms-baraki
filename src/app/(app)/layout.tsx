// App shell — enforces auth (real authorization boundary) and renders the
// full-width console (sidebar + top bar) via AppShell.
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuth();

  const supabase = await createClient();
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("name")
    .eq("id", ctx.profile.warehouse_id)
    .maybeSingle();

  return (
    <AppShell
      role={ctx.profile.role}
      fullName={ctx.profile.full_name}
      warehouseName={warehouse?.name ?? "Almacén"}
    >
      {children}
    </AppShell>
  );
}
