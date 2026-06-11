"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  ScanLine,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  Warehouse,
  PackageMinus,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}
interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "Operación",
    items: [
      { href: "/stow", label: "Guardar", icon: ScanLine, roles: ["operator", "manager", "owner"] },
      { href: "/withdraw", label: "Retirar", icon: PackageMinus, roles: ["operator", "manager", "owner"] },
      { href: "/inventory", label: "Inventario", icon: Boxes, roles: ["operator", "manager", "owner"] },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/approval", label: "Aprobación", icon: ClipboardCheck, roles: ["manager", "owner"] },
      { href: "/dashboard", label: "Panel", icon: LayoutDashboard, roles: ["manager", "owner"] },
      { href: "/team", label: "Equipo", icon: Users, roles: ["manager", "owner"] },
      { href: "/settings", label: "Ajustes", icon: Settings, roles: ["owner"] },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/stow": "Guardar mercancía",
  "/withdraw": "Retirar mercancía",
  "/inventory": "Inventario",
  "/approval": "Cola de aprobación",
  "/dashboard": "Panel de control",
  "/team": "Equipo",
  "/settings": "Ajustes",
};

export function AppShell({
  role,
  fullName,
  warehouseName,
  children,
}: {
  role: Role;
  fullName: string | null;
  warehouseName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const sections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([href]) => pathname.startsWith(href))?.[1] ?? "";

  const initial = (fullName?.trim()?.[0] ?? "U").toUpperCase();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-[0_2px_8px_rgba(225,25,49,0.35)]">
          <Warehouse className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
            [PRODUCT_NAME]
          </div>
          <div className="truncate text-xs text-zinc-400">{warehouseName}</div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-6 px-3 pt-2">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-2 font-[family-name:var(--font-num)] text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-zinc-100 font-semibold text-ink"
                        : "font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand" />
                    )}
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* user */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-zinc-800">
              {fullName || "Usuario"}
            </div>
            <div className="font-[family-name:var(--font-num)] text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
              {role}
            </div>
          </div>
          <button
            onClick={logout}
            title="Salir"
            aria-label="Salir"
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* desktop sidebar (fixed) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white lg:block print:hidden">
        {sidebar}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-2 top-2 z-10 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* content column */}
      <div className="flex flex-1 flex-col lg:pl-60 print:pl-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur lg:px-6 print:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-ink lg:text-[15px]">{pageTitle}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-zinc-500 sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              En vivo
            </span>
            <span className="hidden text-xs font-medium text-zinc-400 md:block">
              {warehouseName}
            </span>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
