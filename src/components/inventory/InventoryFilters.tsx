"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

interface Current {
  category: string;
  zone: string;
  status: string;
  expiry: string;
  q: string;
}

const ZONES = ["general", "refrigerado", "congelado", "hazmat"];
const STATUSES = ["activo", "agotado", "retirado"];
const EXPIRY = [
  { value: "", label: "Caducidad: todas" },
  { value: "rojo", label: "Rojo · <15 días" },
  { value: "amarillo", label: "Amarillo · 15–60 días" },
  { value: "verde", label: "Verde · >60 días" },
  { value: "sin", label: "Sin caducidad" },
];

const FIELD =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-ink";

export function InventoryFilters({
  categories,
  current,
}: {
  categories: string[];
  current: Current;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(current.q);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // reset pagination on filter change
    router.push(`/inventory?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", q.trim());
  }

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <form onSubmit={submitSearch} className="relative col-span-2 sm:w-60">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          strokeWidth={1.8}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nombre o código…"
          className={`${FIELD} pl-9`}
        />
      </form>

      <select
        value={current.category}
        onChange={(e) => setParam("category", e.target.value)}
        className={`${FIELD} sm:w-auto`}
      >
        <option value="">Categoría: todas</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={current.zone}
        onChange={(e) => setParam("zone", e.target.value)}
        className={`${FIELD} sm:w-auto`}
      >
        <option value="">Zona: todas</option>
        {ZONES.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </select>

      <select
        value={current.status}
        onChange={(e) => setParam("status", e.target.value)}
        className={`${FIELD} sm:w-auto`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={current.expiry}
        onChange={(e) => setParam("expiry", e.target.value)}
        className={`${FIELD} sm:w-auto`}
      >
        {EXPIRY.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
