"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Plus, Warehouse, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { levelMeta } from "@/lib/levels";
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
const ZONE_DOT: Record<Zone, string> = {
  general: "bg-zinc-400",
  refrigerado: "bg-cyan-500",
  congelado: "bg-blue-600",
  hazmat: "bg-amber-500",
};

const NUM = "font-[family-name:var(--font-num)] tabular-nums";
const FIELD =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-ink";
const LABEL = `text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 ${NUM}`;

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
  const [levels, setLevels] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // edit / delete a station
  const [editing, setEditing] = useState<StationRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCap, setEditCap] = useState("");
  const [savingStation, setSavingStation] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  function openStationEdit(s: StationRow) {
    setEditing(s);
    setEditName(s.name);
    setEditCap(s.binCount ? String(Math.round(s.capacity / s.binCount)) : "30");
    setEditErr(null);
  }

  async function saveStation() {
    if (!editing) return;
    if (!editName.trim()) {
      setEditErr("Pon un nombre");
      return;
    }
    setSavingStation(true);
    setEditErr(null);
    const supabase = createClient();
    const { error: stErr } = await supabase
      .from("stations")
      .update({ name: editName.trim() })
      .eq("id", editing.id)
      .eq("warehouse_id", warehouseId);
    // bulk capacity for all bins of this station (optional)
    const cap = parseInt(editCap, 10);
    let binErr = null;
    if (Number.isFinite(cap) && cap >= 1) {
      const { error } = await supabase
        .from("bins")
        .update({ capacity: cap })
        .eq("station_id", editing.id)
        .eq("warehouse_id", warehouseId);
      binErr = error;
    }
    setSavingStation(false);
    if (stErr || binErr) {
      setEditErr(stErr?.message ?? binErr?.message ?? "No se pudo guardar");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  // Delete is safe: blocked if the station holds stock; falls back to
  // deactivating when historical batches still reference its bins (FK).
  async function deleteStation() {
    if (!editing) return;
    if (editing.used > 0) {
      setEditErr("Esta estación tiene mercancía. Vacíala antes de borrarla.");
      return;
    }
    setSavingStation(true);
    setEditErr(null);
    const supabase = createClient();
    const { error: binErr } = await supabase
      .from("bins")
      .delete()
      .eq("station_id", editing.id)
      .eq("warehouse_id", warehouseId);
    if (binErr) {
      // historical batches reference these bins → soft-delete instead
      await supabase.from("bins").update({ active: false }).eq("station_id", editing.id);
      await supabase.from("stations").update({ active: false }).eq("id", editing.id);
      setSavingStation(false);
      setEditing(null);
      router.refresh();
      return;
    }
    await supabase
      .from("stations")
      .delete()
      .eq("id", editing.id)
      .eq("warehouse_id", warehouseId);
    setSavingStation(false);
    setEditing(null);
    router.refresh();
  }

  // contiguous level bands: ceil(N/levels) positions per level, level 1 first
  const lv = Math.min(5, Math.max(1, levels));
  const perLevel = binCount > 0 ? Math.ceil(binCount / lv) : 0;
  const bands = perLevel
    ? Array.from({ length: lv }, (_, idx) => ({
        level: idx + 1,
        from: idx * perLevel + 1,
        to: Math.min(binCount, (idx + 1) * perLevel),
      })).filter((b) => b.from <= binCount)
    : [];

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
      // probe the level column (may not exist pre-migration)
      const { error: probeErr } = await supabase.from("bins").select("level").limit(1);
      const hasLevel = !probeErr;
      const prefix = prefixFor(name.trim(), zone);
      const rows = Array.from({ length: binCount }, (_, i) => ({
        warehouse_id: warehouseId,
        station_id: station.id,
        code: `${prefix}-${String(i + 1).padStart(2, "0")}`,
        position: i + 1,
        zone,
        capacity: binCap,
        ...(hasLevel ? { level: Math.min(lv, Math.floor(i / perLevel) + 1) } : {}),
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
    // Extending a run adds bins across the station's existing shelves: cycle
    // new bins over its distinct levels. (Probe doubles as pre-migration check.)
    const { data: lvlRows, error: probeErr } = await supabase
      .from("bins")
      .select("level")
      .eq("station_id", station.id);
    const hasLevel = !probeErr;
    const cycle = hasLevel
      ? [...new Set((lvlRows ?? []).map((r) => r.level ?? 1))].sort((a, b) => a - b)
      : [1];
    const prefix = prefixFor(station.name, station.zone);
    const rows = Array.from({ length: n }, (_, i) => ({
      warehouse_id: warehouseId,
      station_id: station.id,
      code: `${prefix}-${String(station.binCount + i + 1).padStart(2, "0")}`,
      position: station.binCount + i + 1,
      zone: station.zone,
      capacity: binCap,
      ...(hasLevel ? { level: cycle[i % cycle.length] } : {}),
    }));
    const { error: binErr } = await supabase.from("bins").insert(rows);
    if (binErr) setError(binErr.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Grid3x3 className="h-4 w-4 text-zinc-400" strokeWidth={1.8} />
          Estaciones y ubicaciones
        </h2>
        <span className={`text-[11px] text-zinc-400 ${NUM}`}>
          {stations.length} estaciones
        </span>
      </header>

      {error && (
        <p className="border-b border-line bg-red-50 px-5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* stations list */}
      {stations.length === 0 ? (
        <div className="p-5">
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400">
            <Warehouse className="mx-auto mb-2 h-6 w-6 text-zinc-300" strokeWidth={1.8} />
            Aún no hay estaciones.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {stations.map((s) => {
            const pct = s.capacity ? Math.round((100 * s.used) / s.capacity) : 0;
            const fill = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-ink";
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 transition hover:bg-zinc-50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${ZONE_DOT[s.zone]}`} />
                  <span className="truncate text-sm font-medium text-ink">{s.name}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {ZONES.find((z) => z.value === s.zone)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs text-zinc-500 ${NUM}`}>
                    {s.binCount} ubic. · {s.used}/{s.capacity} u
                  </span>
                  <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100 sm:block">
                    <span
                      className={`block h-full rounded-full ${fill}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </span>
                  <span className={`w-9 text-right text-xs font-semibold text-ink ${NUM}`}>
                    {pct}%
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => addBins(s, 6)}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />6 ubic.
                  </button>
                  <button
                    type="button"
                    onClick={() => openStationEdit(s)}
                    aria-label="Editar estación"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* create station */}
      <div className="border-t border-line bg-zinc-50/60 px-5 py-4">
        <div className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
          Nueva estación
        </div>
        <form onSubmit={createStation} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Nombre</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nueva estación (ej. Recepción 2)"
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Zona</span>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value as Zone)}
                className={FIELD}
              >
                {ZONES.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Ubicaciones</span>
              <input
                type="number"
                min={0}
                max={60}
                value={binCount}
                onChange={(e) => setBinCount(Number(e.target.value) || 0)}
                title="Nº de ubicaciones"
                className={`${FIELD} ${NUM}`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Capacidad</span>
              <input
                type="number"
                min={1}
                value={binCap}
                onChange={(e) => setBinCap(Number(e.target.value) || 1)}
                title="Capacidad por ubicación"
                className={`${FIELD} ${NUM}`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Niveles</span>
              <input
                type="number"
                min={1}
                max={5}
                value={levels}
                onChange={(e) =>
                  setLevels(Math.min(5, Math.max(1, Number(e.target.value) || 1)))
                }
                title="Niveles de estantería (1–5)"
                className={`${FIELD} ${NUM}`}
              />
            </label>
          </div>

          {/* level distribution preview (mirrors the physical label colors) */}
          {bands.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">Distribución:</span>
              {bands.map((b) => {
                const meta = levelMeta(b.level);
                return (
                  <span
                    key={b.level}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${NUM}`}
                    style={{ backgroundColor: meta.color, color: meta.text }}
                  >
                    N{b.level} · {b.from === b.to ? b.from : `${b.from}–${b.to}`}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {busy ? "Creando…" : "Crear estación"}
            </button>
            <p className="text-xs text-zinc-400">
              Crea una estación con N ubicaciones de la capacidad indicada, repartidas en
              niveles contiguos. Al guardar, cada producto irá a una ubicación de su zona.
            </p>
          </div>
        </form>
      </div>

      {/* edit / delete station sheet */}
      {editing && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5 shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[28rem] lg:rounded-none lg:rounded-l-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Editar estación</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3.5">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Nombre</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`h-11 ${FIELD}`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Capacidad por ubicación (todas)</span>
                <input
                  type="number"
                  min={1}
                  value={editCap}
                  onChange={(e) => setEditCap(e.target.value)}
                  className={`h-11 ${FIELD} ${NUM}`}
                />
                <span className="text-xs text-zinc-400">
                  Aplica a las {editing.binCount} ubicaciones de esta estación.
                </span>
              </label>
              {editErr && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
                  {editErr}
                </p>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={deleteStation}
                disabled={savingStation}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Borrar
              </button>
              <button
                type="button"
                onClick={saveStation}
                disabled={savingStation}
                className="h-11 flex-1 rounded-xl bg-ink text-sm font-bold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50"
              >
                {savingStation ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
