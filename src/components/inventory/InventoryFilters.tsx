"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
  { value: "rojo", label: "🔴 <15 días" },
  { value: "amarillo", label: "🟡 15–60 días" },
  { value: "verde", label: "🟢 >60 días" },
  { value: "sin", label: "Sin caducidad" },
];

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

  const sel =
    "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900 sm:w-auto";

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <form onSubmit={submitSearch} className="col-span-2 sm:w-56">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nombre o código…"
          className={sel}
        />
      </form>

      <select
        value={current.category}
        onChange={(e) => setParam("category", e.target.value)}
        className={sel}
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
        className={sel}
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
        className={sel}
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
        className={sel}
      >
        {EXPIRY.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
    </div>
  );
}
