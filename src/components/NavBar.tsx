"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const ITEMS: NavItem[] = [
  { href: "/scan", label: "Escanear", roles: ["operator", "manager", "owner"] },
  { href: "/approval", label: "Aprobación", roles: ["manager", "owner"] },
  { href: "/inventory", label: "Inventario", roles: ["operator", "manager", "owner"] },
  { href: "/settings", label: "Ajustes", roles: ["owner"] },
];

export function NavBar({
  role,
  fullName,
  warehouseName,
}: {
  role: Role;
  fullName: string | null;
  warehouseName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = ITEMS.filter((i) => i.roles.includes(role));

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        {/* row 1: brand + user/logout */}
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0 truncate">
            <span className="text-lg font-bold text-slate-900">[PRODUCT_NAME]</span>
            <span className="ml-2 hidden text-sm text-slate-500 sm:inline">
              {warehouseName}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {fullName || "Usuario"}{" "}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs uppercase text-slate-500">
                {role}
              </span>
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 active:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
        {/* row 2: nav (scrolls horizontally if it ever overflows) */}
        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto pb-2">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
