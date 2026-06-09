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
const ZONE_DOT: Record<Zone, string> = {
  general: "bg-slate-400",
  refrigerado: "bg-cyan-400",
  congelado: "bg-blue-400",
  hazmat: "bg-amber-400",
};

const NUM = "font-[family-name:var(--font-num)] tabular-nums";
const DISPLAY = "font-[family-name:var(--font-display)]";
const GLOW =
  "radial-gradient(55% 110% at 100% 0%, rgba(163,230,53,0.12), transparent 60%), radial-gradient(45% 90% at 0% 0%, rgba(56,189,248,0.10), transparent 55%)";
const GRID =
  "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)";

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
      setFlash(`${scanned.label} ×${quantity} → ${data.bin_code}`);
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
      <div className="mx-auto max-w-3xl rounded-3xl bg-[#0a0e17] p-10 text-center text-slate-400 ring-1 ring-white/10">
        No hay estaciones configuradas. Pídele a un gerente que cree una estación y sus
        bins en el Panel.
      </div>
    );
  }

  const selectedCode =
    scanned?.suggestion.strip.find((c) => c.id === selectedBinId)?.code ??
    scanned?.suggestion.binCode ??
    null;
  const idleStrip = stationStrips[stationId] ?? [];

  const darkField =
    "rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-lime-400 [&>option]:text-slate-900";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-[#0a0e17] text-slate-200 shadow-2xl ring-1 ring-white/10">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: GLOW }} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: GRID, backgroundSize: "34px 34px" }}
        />

        <div className="relative">
          {/* header */}
          <div className="deck-rise flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <span className={`h-2 w-2 rounded-full ${ZONE_DOT[zone]}`} />
                Estación · {ZONE_LABEL[zone]}
              </div>
              <div className={`truncate text-2xl font-extrabold text-white ${DISPLAY}`}>
                {station?.name}
              </div>
            </div>
            <select
              value={stationId}
              onChange={(e) => {
                setStationId(e.target.value);
                resetForNext();
              }}
              className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none [&>option]:text-slate-900"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="px-5 py-5 sm:px-7">
            {flash && (
              <p className="deck-rise mb-4 rounded-xl bg-lime-400/15 px-4 py-3 text-center text-base font-semibold text-lime-300 ring-1 ring-lime-400/30">
                ✓ {flash}
              </p>
            )}

            {!scanned ? (
              /* ── IDLE ── */
              <div className="deck-rise">
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                    <Package className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
                  </div>
                  <h1 className={`text-3xl font-extrabold text-white ${DISPLAY}`}>
                    Escanea un producto
                  </h1>
                  <p className="mt-1 text-slate-400">
                    Lo guardamos en un bin de {ZONE_LABEL[zone]}
                  </p>
                </div>

                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={onBarcodeKeyDown}
                  placeholder="Escanea con la pistola o teclea…"
                  className={`w-full rounded-xl border border-white/15 bg-white/5 px-4 py-4 text-center text-xl text-white outline-none placeholder:text-slate-500 focus:border-lime-400 ${NUM}`}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-base font-semibold text-white active:bg-white/20"
                  >
                    <Camera className="h-5 w-5" /> Cámara
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScan(null)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-base font-semibold text-slate-200 active:bg-white/10"
                  >
                    <PackagePlus className="h-5 w-5" /> Sin código
                  </button>
                </div>

                {idleStrip.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Bins de la estación
                    </div>
                    <BinStrip cells={idleStrip} />
                  </div>
                )}
              </div>
            ) : (
              /* ── SCANNED ── */
              <div className="deck-rise space-y-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Producto {scanned.enrichmentStatus === "queued" && "· identificando…"}
                    </div>
                    <div className="truncate text-xl font-bold text-white">{scanned.label}</div>
                    {scanned.barcode && (
                      <div className={`text-sm text-slate-500 ${NUM}`}>{scanned.barcode}</div>
                    )}
                    {scanned.category && (
                      <div className="mt-1 inline-block rounded bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                        {scanned.category}
                      </div>
                    )}
                  </div>
                  {selectedCode ? (
                    <div className="rounded-2xl bg-lime-400 px-6 py-4 text-center text-slate-900">
                      <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                        Guardar en
                      </div>
                      <div className={`text-4xl font-extrabold leading-tight ${NUM}`}>
                        {selectedCode}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-red-500/15 px-6 py-4 text-center text-red-300 ring-1 ring-red-500/30">
                      <div className="text-sm font-semibold">{scanned.suggestion.reason}</div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Toca otro bin para cambiar
                  </div>
                  <BinStrip
                    cells={scanned.suggestion.strip}
                    selectedBinId={selectedBinId}
                    onSelect={setSelectedBinId}
                  />
                </div>

                <div>
                  <div className="mb-1 text-sm font-medium text-slate-300">Cantidad</div>
                  <QuickNumPad value={quantity} onChange={setQuantity} variant="dark" />
                </div>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy || !selectedBinId}
                  className="w-full rounded-2xl bg-lime-400 px-4 py-5 text-xl font-extrabold text-slate-900 transition hover:bg-lime-300 disabled:opacity-50"
                >
                  {busy ? "Guardando…" : "Confirmar stow"}
                </button>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowMeta((v) => !v)}
                    className="text-sm font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                  >
                    {showMeta ? "Ocultar detalles" : "Condición / origen / caducidad"}
                  </button>
                  {showMeta && (
                    <div className="mt-2 grid gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Condición</label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value as Condition)}
                          className={`mt-1 w-full ${darkField}`}
                        >
                          {CONDITIONS.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Origen</label>
                        <select
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value as Origin)}
                          className={`mt-1 w-full ${darkField}`}
                        >
                          {ORIGINS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400">Caducidad (MMYY)</label>
                        <input
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          inputMode="numeric"
                          maxLength={5}
                          placeholder="1226"
                          className={`mt-1 w-full ${darkField} ${NUM}`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={resetForNext}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-300"
                >
                  Cancelar y escanear otro
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
                {error}
              </p>
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
        </div>
      </div>

      {/* recent */}
      {recent.length > 0 && (
        <div className="rounded-2xl bg-[#0a0e17] p-4 text-slate-200 ring-1 ring-white/10">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Guardados en esta sesión ({recent.length})
          </h2>
          <ul className="space-y-1.5">
            {recent.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-slate-200">
                  {r.label} <span className="text-slate-500">×{r.quantity}</span>
                </span>
                <span className={`ml-2 shrink-0 rounded-full bg-lime-400 px-2 py-0.5 text-xs font-bold text-slate-900 ${NUM}`}>
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
