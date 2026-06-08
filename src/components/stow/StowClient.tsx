"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Package, Camera, PackagePlus } from "lucide-react";
import { QuickNumPad } from "@/components/QuickNumPad";
import { CameraScanner } from "@/components/CameraScanner";
import { BinStrip } from "@/components/stow/BinStrip";
import type { BinStripCell } from "@/lib/rules/putaway";
import type { Condition, Origin, EnrichmentStatus, Zone } from "@/lib/types";

interface StationOpt {
  id: string;
  name: string;
  zone: Zone;
}
interface Suggestion {
  zone: Zone;
  binId: string | null;
  binCode: string | null;
  stationName: string | null;
  strip: BinStripCell[];
  reason: string;
}
interface Scanned {
  productId: string;
  label: string;
  category: string | null;
  barcode: string | null;
  enrichmentStatus: EnrichmentStatus;
  suggestion: Suggestion;
}
interface RecentItem {
  id: string;
  label: string;
  quantity: number;
  binCode: string;
}

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "open_box", label: "Open box" },
  { value: "dañado", label: "Dañado" },
];
const ORIGINS: { value: Origin; label: string }[] = [
  { value: "amazon", label: "Amazon" },
  { value: "walmart", label: "Walmart" },
  { value: "local", label: "Local" },
  { value: "otro", label: "Otro" },
];
const ZONE_LABEL: Record<Zone, string> = {
  general: "Ambiente",
  refrigerado: "Refrigerado",
  congelado: "Congelado",
  hazmat: "Hazmat",
};
const ZONE_BAR: Record<Zone, string> = {
  general: "bg-slate-800",
  refrigerado: "bg-cyan-600",
  congelado: "bg-blue-700",
  hazmat: "bg-amber-600",
};

function mmyyToDate(mmyy: string): string | null {
  const m = mmyy.replace(/\D/g, "");
  if (m.length !== 4) return null;
  const month = parseInt(m.slice(0, 2), 10);
  const year = 2000 + parseInt(m.slice(2), 10);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function StowClient({
  stations,
  stationStrips,
}: {
  stations: StationOpt[];
  stationStrips: Record<string, BinStripCell[]>;
}) {
  const [stationId, setStationId] = useState(stations[0]?.id ?? "");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<Condition>("nuevo");
  const [origin, setOrigin] = useState<Origin>("otro");
  const [expiry, setExpiry] = useState("");

  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [showMeta, setShowMeta] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const focusBarcode = useCallback(() => {
    requestAnimationFrame(() => barcodeRef.current?.focus());
  }, []);
  useEffect(() => focusBarcode(), [focusBarcode]);

  const station = stations.find((s) => s.id === stationId);
  const zone = station?.zone ?? "general";

  function resetForNext() {
    setScanned(null);
    setSelectedBinId(null);
    setBarcode("");
    setQuantity(1);
    setExpiry("");
    focusBarcode();
  }

  async function handleScan(code: string | null) {
    if (!stationId) {
      setError("Selecciona una estación");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stow/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code, station_id: stationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo escanear");
        return;
      }
      const s: Scanned = {
        productId: data.product_id,
        label: data.product?.name || code || "Producto sin nombre",
        category: data.product?.category ?? null,
        barcode: data.barcode ?? code,
        enrichmentStatus: data.enrichment_status,
        suggestion: data.suggestion,
      };
      setScanned(s);
      setSelectedBinId(s.suggestion.binId);
      if (data.enrichment_status === "queued") {
        fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: data.product_id }),
        }).catch(() => {});
      }
    } catch {
      setError("Error de red al escanear");
    } finally {
      setBusy(false);
    }
  }

  function onBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (barcode.trim()) handleScan(barcode.trim());
    }
  }

  async function handleConfirm() {
    if (!scanned || !selectedBinId) {
      setError("No hay bin seleccionado");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stow/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: scanned.productId,
          bin_id: selectedBinId,
          quantity,
          condition,
          origin,
          expiration_date: mmyyToDate(expiry),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar");
        return;
      }
      navigator.vibrate?.(120);
      setRecent((prev) =>
        [{ id: data.batch_id, label: scanned.label, quantity, binCode: data.bin_code }, ...prev].slice(0, 20),
      );
      setFlash(`✓ ${scanned.label} ×${quantity} → ${data.bin_code}`);
      setTimeout(() => setFlash(null), 2200);
      resetForNext();
    } catch {
      setError("Error de red al guardar");
    } finally {
      setBusy(false);
    }
  }

  if (stations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        No hay estaciones configuradas. Pídele a un gerente que cree una estación y
        sus bins en el Panel.
      </div>
    );
  }

  const selectedCode =
    scanned?.suggestion.strip.find((c) => c.id === selectedBinId)?.code ??
    scanned?.suggestion.binCode ??
    null;
  const idleStrip = stationStrips[stationId] ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── station header bar (zone color) ── */}
      <div
        className={`flex items-center justify-between gap-3 rounded-t-2xl px-5 py-3 text-white ${ZONE_BAR[zone]}`}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">
            Estación · {ZONE_LABEL[zone]}
          </div>
          <div className="truncate text-xl font-bold">{station?.name}</div>
        </div>
        <select
          value={stationId}
          onChange={(e) => {
            setStationId(e.target.value);
            resetForNext();
          }}
          className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white outline-none [&>option]:text-slate-900"
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-white p-5">
        {flash && (
          <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-center text-base font-semibold text-green-700">
            {flash}
          </p>
        )}

        {!scanned ? (
          /* ── IDLE: scan prompt ── */
          <div>
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Package className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Escanea un producto</h1>
              <p className="mt-1 text-slate-500">
                Lo guardamos en un bin de {ZONE_LABEL[zone]}
              </p>
            </div>

            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={onBarcodeKeyDown}
              placeholder="Escanea con la pistola o teclea…"
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-4 text-center font-mono text-xl text-slate-900 outline-none focus:border-slate-900"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-base font-semibold text-white active:bg-slate-700"
              >
                <Camera className="h-5 w-5" /> Cámara
              </button>
              <button
                type="button"
                onClick={() => handleScan(null)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-700 active:bg-slate-100"
              >
                <PackagePlus className="h-5 w-5" /> Sin código
              </button>
            </div>

            {idleStrip.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-xs font-medium uppercase text-slate-400">
                  Bins de la estación
                </div>
                <BinStrip cells={idleStrip} />
              </div>
            )}
          </div>
        ) : (
          /* ── SCANNED: stow target ── */
          <div className="space-y-5">
            {/* big target */}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-slate-400">
                  Producto {scanned.enrichmentStatus === "queued" && "· identificando…"}
                </div>
                <div className="truncate text-xl font-bold text-slate-900">
                  {scanned.label}
                </div>
                {scanned.barcode && (
                  <div className="font-mono text-sm text-slate-400">{scanned.barcode}</div>
                )}
                {scanned.category && (
                  <div className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {scanned.category}
                  </div>
                )}
              </div>
              {/* HUGE bin target */}
              {selectedCode ? (
                <div className="rounded-2xl bg-green-500 px-6 py-4 text-center text-white">
                  <div className="text-[11px] font-semibold uppercase opacity-85">Guardar en</div>
                  <div className="font-mono text-3xl font-extrabold leading-tight">
                    {selectedCode}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-red-100 px-6 py-4 text-center text-red-700">
                  <div className="text-sm font-semibold">{scanned.suggestion.reason}</div>
                </div>
              )}
            </div>

            {/* strip */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-slate-400">
                Toca otro bin para cambiar
              </div>
              <BinStrip
                cells={scanned.suggestion.strip}
                selectedBinId={selectedBinId}
                onSelect={setSelectedBinId}
              />
            </div>

            {/* quantity */}
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Cantidad</div>
              <QuickNumPad value={quantity} onChange={setQuantity} />
            </div>

            {/* confirm — big */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !selectedBinId}
              className="w-full rounded-2xl bg-green-600 px-4 py-5 text-xl font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Confirmar stow"}
            </button>

            {/* secondary meta (collapsed) */}
            <div>
              <button
                type="button"
                onClick={() => setShowMeta((v) => !v)}
                className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
              >
                {showMeta ? "Ocultar detalles" : "Condición / origen / caducidad"}
              </button>
              {showMeta && (
                <div className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Condición</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as Condition)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Origen</label>
                    <select
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value as Origin)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
                    >
                      {ORIGINS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Caducidad (MMYY)</label>
                    <input
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="1226"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={resetForNext}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-600"
            >
              Cancelar y escanear otro
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {showCamera && (
          <CameraScanner
            onScan={(text) => {
              setShowCamera(false);
              setBarcode(text);
              handleScan(text);
            }}
            onClose={() => setShowCamera(false)}
          />
        )}
      </div>

      {/* recent */}
      {recent.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Guardados en esta sesión ({recent.length})
          </h2>
          <ul className="space-y-1.5">
            {recent.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  {r.label} <span className="text-slate-400">×{r.quantity}</span>
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-slate-900 px-2 py-0.5 font-mono text-xs text-white">
                  {r.binCode}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
