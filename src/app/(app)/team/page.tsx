// /team — accounts of this warehouse (manager / owner). The admin gives
// employees their accounts here; nobody self-registers into a warehouse.
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserManager, type TeamMember } from "@/components/team/UserManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireRole("manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("warehouse_id", wh)
    .order("created_at", { ascending: true });

  // emails live in auth.users → resolve with the service-role client
  const emailById = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of data?.users ?? []) if (u.email) emailById.set(u.id, u.email);
  } catch {
    /* emails are best-effort */
  }

  const members: TeamMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role,
    email: emailById.get(p.id) ?? null,
    isSelf: p.id === ctx.userId,
  }));

  return (
    <div className="flex-1 px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-3xl">
        <div className="deck-rise mb-6">
          <div className="mb-1 font-[family-name:var(--font-num)] text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Gestión · Cuentas
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Equipo</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Da de alta a tus operarios y encargados. Cada persona entra con su correo y
            contraseña; nadie se registra solo.
          </p>
        </div>
        <UserManager members={members} creatorRole={ctx.profile.role} />
      </div>
    </div>
  );
}
