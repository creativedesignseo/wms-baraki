// App shell — enforces auth (real authorization boundary) and renders the nav.
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

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
    <div className="min-h-screen bg-slate-50">
      <NavBar
        role={ctx.profile.role}
        fullName={ctx.profile.full_name}
        warehouseName={warehouse?.name ?? "Almacén"}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
