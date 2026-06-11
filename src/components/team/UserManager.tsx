"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ShieldCheck, User } from "lucide-react";
import type { Role } from "@/lib/types";

export interface TeamMember {
  id: string;
  fullName: string | null;
  role: Role;
  email: string | null;
  isSelf: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  operator: "Operario",
  manager: "Encargado",
  owner: "Dueño",
};
const NUM = "font-[family-name:var(--font-num)] tabular-nums";
const FIELD =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-ink";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400";

export function UserManager({
  members,
  creatorRole,
}: {
  members: TeamMember[];
  creatorRole: Role;
}) {
  const router = useRouter();
  // a manager can only create operators; an owner can create any role
  const allowedRoles: Role[] =
    creatorRole === "owner" ? ["operator", "manager", "owner"] : ["operator"];

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta");
        return;
      }
      setOk(`Cuenta creada para ${email}. Ya puede iniciar sesión.`);
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("operator");
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* current team */}
      <section className="deck-rise overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Cuentas del almacén</h2>
          <span className={`text-[11px] text-zinc-400 ${NUM}`}>{members.length}</span>
        </header>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  m.role === "owner"
                    ? "bg-brand-soft text-brand"
                    : m.role === "manager"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {(m.fullName?.trim()?.[0] ?? m.email?.[0] ?? "U").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">
                  {m.fullName || "—"}
                  {m.isSelf && <span className="ml-1.5 text-xs text-zinc-400">(tú)</span>}
                </div>
                <div className="truncate text-xs text-zinc-400">{m.email ?? "—"}</div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  m.role === "operator"
                    ? "bg-zinc-100 text-zinc-600"
                    : "bg-zinc-900 text-white"
                }`}
              >
                {m.role === "operator" ? (
                  <User className="h-3 w-3" />
                ) : (
                  <ShieldCheck className="h-3 w-3" />
                )}
                {ROLE_LABEL[m.role]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* create */}
      <section
        className="deck-rise rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        style={{ animationDelay: "60ms" }}
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <UserPlus className="h-4 w-4 text-zinc-400" strokeWidth={1.8} /> Dar de alta una cuenta
        </h2>
        <form onSubmit={createUser} className="space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Nombre</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nombre del empleado"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL}>Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={FIELD}
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operario@almacen.com"
                className={FIELD}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={LABEL}>Contraseña inicial</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                className={`${FIELD} ${NUM}`}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
          {ok && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
              {ok}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" /> {busy ? "Creando…" : "Crear cuenta"}
            </button>
            <p className="text-xs text-zinc-400">
              Entrega el correo y la contraseña al empleado. Podrá cambiarla al entrar.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
