"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Zone } from "@/lib/types";

interface StationRow {
  id: string;
  name: string;
  zone: Zone;
  active: boolean;
  binCount: number;
  used: number;
  capacity: number;
}

const ZONES: { value: Zone; label: string }[] = [
  { value: "general", label: "Ambiente" },
  { value: "refrigerado", label: "Refrigerado" },
  { value: "congelado", label: "Congelado" },
  { value: "hazmat", label: "Hazmat" },
];

function prefixFor(name: string, zone: Zone): string {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
  if (initials) return initials;
  return { general: "AMB", refrigerado: "REF", congelado: "CON", hazmat: "HAZ" }[zone];
}

export function StationsManager({
  warehouseId,
  stations,
}: {
  warehouseId: string;
  stations: StationRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [zone, setZone] = useState<Zone>("general");
  const [binCount, setBinCount] = useState(12);
  const [binCap, setBinCap] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createStation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Pon un nombre a la estación");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data: station, error: stErr } = await supabase
      .from("stations")
      .insert({ warehouse_id: warehouseId, name: name.trim(), zone })
      .select("id")
      .single();
    if (stErr || !station) {
      setError(stErr?.message ?? "No se pudo crear la estación");
      setBusy(false);
      return;
    }
    // generate its bins
    if (binCount > 0) {
      const prefix = prefixFor(name.trim(), zone);
      const rows = Array.from({ length: binCount }, (_, i) => ({
        warehouse_id: warehouseId,
        station_id: station.id,
        code: `${prefix}-${String(i + 1).padStart(2, "0")}`,
        position: i + 1,
        zone,
        capacity: binCap,
      }));
      const { error: binErr } = await supabase.from("bins").insert(rows);
      if (binErr) {
        setError(`Estación creada, pero fallaron los bins: ${binErr.message}`);
        setBusy(false);
        router.refresh();
        return;
      }
    }
    setName("");
    setBusy(false);
    router.refresh();
  }

  async function addBins(station: StationRow, n: number) {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const prefix = prefixFor(station.name, station.zone);
    const rows = Array.from({ length: n }, (_, i) => ({
      warehouse_id: warehouseId,
      station_id: station.id,
      code: `${prefix}-${String(station.binCount + i + 1).padStart(2, "0")}`,
      position: station.binCount + i + 1,
      zone: station.zone,
      capacity: binCap,
    }));
    const { error: binErr } = await supabase.from("bins").insert(rows);
    if (binErr) setError(binErr.message);
    setBusy(false);
    router.refresh();
  }

  const field =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Estaciones y bins</h2>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* list */}
      <div className="mb-5 space-y-2">
        {stations.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay estaciones.</p>
        ) : (
          stations.map((s) => {
            const pct = s.capacity ? Math.round((100 * s.used) / s.capacity) : 0;
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {ZONES.find((z) => z.value === s.zone)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>
                    {s.binCount} bins · {s.used}/{s.capacity} u ({pct}%)
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => addBins(s, 6)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    + 6 bins
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* create station */}
      <form
        onSubmit={createStation}
        className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva estación (ej. Recepción 2)"
          className={field}
        />
        <select value={zone} onChange={(e) => setZone(e.target.value as Zone)} className={field}>
          {ZONES.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={60}
          value={binCount}
          onChange={(e) => setBinCount(Number(e.target.value) || 0)}
          title="Nº de bins"
          className={`${field} w-24`}
        />
        <input
          type="number"
          min={1}
          value={binCap}
          onChange={(e) => setBinCap(Number(e.target.value) || 1)}
          title="Capacidad por bin"
          className={`${field} w-24`}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "…" : "Crear"}
        </button>
      </form>
      <p className="mt-1 text-xs text-slate-400">
        Crea una estación con N bins de la capacidad indicada. El stow llevará cada
        producto a un bin de su zona.
      </p>
    </section>
  );
}
