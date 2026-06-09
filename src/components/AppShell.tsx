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
  LogOut,
  Warehouse,
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

const ITEMS: NavItem[] = [
  { href: "/stow", label: "Stow", icon: ScanLine, roles: ["operator", "manager", "owner"] },
  { href: "/inventory", label: "Inventario", icon: Boxes, roles: ["operator", "manager", "owner"] },
  { href: "/approval", label: "Aprobación", icon: ClipboardCheck, roles: ["manager", "owner"] },
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard, roles: ["manager", "owner"] },
  { href: "/settings", label: "Ajustes", icon: Settings, roles: ["owner"] },
];

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
  const items = ITEMS.filter((i) => i.roles.includes(role));

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Warehouse className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="font-[family-name:var(--font-display)] text-base font-extrabold leading-tight text-slate-900">
            [PRODUCT_NAME]
          </div>
          <div className="truncate text-xs text-slate-400">{warehouseName}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" /> {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="mb-1 px-2">
          <div className="truncate text-sm font-medium text-slate-700">
            {fullName || "Usuario"}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {role}
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* desktop sidebar (fixed) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block">
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
              className="absolute right-2 top-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* content area */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-[family-name:var(--font-display)] font-extrabold text-slate-900 lg:hidden">
            [PRODUCT_NAME]
          </span>
          <div className="ml-auto hidden items-center gap-2 text-sm text-slate-500 lg:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            En vivo · {warehouseName}
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
