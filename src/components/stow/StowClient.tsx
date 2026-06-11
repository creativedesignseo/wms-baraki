"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Package,
  Camera,
  PackagePlus,
  Check,
  Minus,
  Plus,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { BinWall } from "@/components/stow/BinWall";
import { levelMeta } from "@/lib/levels";
import type { BinStripCell } from "@/lib/rules/putaway";
import type { Condition, Origin, EnrichmentStatus, Zone } from "@/lib/types";

interface Suggestion {
  zone: Zone;
  binId: string | null;
  binCode: string | null;
  binLevel: number | null;
  binPosition: number | null;
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
  level: number;
  position: number | null;
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
  general: "bg-zinc-400",
  refrigerado: "bg-cyan-500",
  congelado: "bg-blue-600",
  hazmat: "bg-amber-500",
};

const NUM = "font-[family-name:var(--font-num)] tabular-nums";

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
  zones,
  zoneStrips,
}: {
  zones: Zone[];
  zoneStrips: Record<string, BinStripCell[]>;
}) {
  const [zone, setZone] = useState<Zone>(zones[0] ?? "general");
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

  function resetForNext() {
    setScanned(null);
    setSelectedBinId(null);
    setBarcode("");
    setQuantity(1);
    setExpiry("");
    setShowMeta(false);
    focusBarcode();
  }

  const doScan = useCallback(async (code: string | null, zoneArg: Zone) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stow/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code, zone: zoneArg }),
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
  }, []);

  function onBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (barcode.trim()) doScan(barcode.trim(), zone);
    }
  }

  // change zone: re-suggest for the same product if one is already scanned
  function changeZone(z: Zone) {
    setZone(z);
    if (scanned) doScan(scanned.barcode, z);
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
      const cell = scanned.suggestion.strip.find((c) => c.id === selectedBinId);
      setRecent((prev) =>
        [
          {
            id: data.batch_id,
            label: scanned.label,
            quantity,
            binCode: data.bin_code,
            level: cell?.level ?? 1,
            position: cell?.position ?? null,
          },
          ...prev,
        ].slice(0, 30),
      );
      setFlash(`${scanned.label} ×${quantity} → ${data.bin_code}`);
      setTimeout(() => setFlash(null), 2400);
      resetForNext();
    } catch {
      setError("Error de red al guardar");
    } finally {
      setBusy(false);
    }
  }

  if (zones.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
          No hay bins configurados. Pídele a un gerente que cree estaciones y bins en el Panel.
        </div>
      </div>
    );
  }

  const strip = scanned ? scanned.suggestion.strip : (zoneStrips[zone] ?? []);
  const selectedCell = scanned ? strip.find((c) => c.id === selectedBinId) : undefined;
  const selectedMeta = selectedCell ? levelMeta(selectedCell.level) : null;
  const avgPct = strip.length
    ? Math.round(strip.reduce((s, c) => s + Math.min(100, c.pct), 0) / strip.length)
    : 0;
  const bump = (n: number) => setQuantity((q) => Math.max(1, q + n));
  const field =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-ink";

  return (
    <div className="flex flex-1 flex-col">
      {/* ── zone bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2.5 lg:px-6">
        <span className={`hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:block ${NUM}`}>
          Zona
        </span>
        <div className="flex rounded-lg border border-line bg-zinc-50 p-0.5">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => changeZone(z)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                z === zone
                  ? "bg-white font-semibold text-ink shadow-sm ring-1 ring-black/5"
                  : "font-medium text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${ZONE_DOT[z]}`} />
              {ZONE_LABEL[z]}
            </button>
          ))}
        </div>
        <div className={`ml-auto text-xs text-zinc-400 ${NUM}`}>
          {strip.length} bins · {avgPct}% ocupado
        </div>
      </div>

      {/* ── workspace: rail + wall ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* left rail */}
        <div className="flex w-full flex-col border-b border-line bg-white lg:w-[400px] lg:border-b-0 lg:border-r xl:w-[440px]">
          {error && (
            <p className="mx-5 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          {!scanned ? (
            <>
              {/* scan block */}
              <div className="p-5 lg:p-6">
                <div className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                  Escanear
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Escanea un producto
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Irá a un bin de <strong className="font-semibold text-zinc-700">{ZONE_LABEL[zone]}</strong>.
                  Cámbialo arriba si es frío o congelado.
                </p>

                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={onBarcodeKeyDown}
                  placeholder="Pistola o teclado…"
                  className={`mt-4 h-14 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 text-center text-lg text-ink outline-none transition focus:border-brand focus:bg-white focus:shadow-[0_0_0_4px_rgba(225,25,49,0.08)] ${NUM}`}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98]"
                  >
                    <Camera className="h-4.5 w-4.5" /> Cámara
                  </button>
                  <button
                    type="button"
                    onClick={() => doScan(null, zone)}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
                  >
                    <PackagePlus className="h-4.5 w-4.5" /> Sin código
                  </button>
                </div>
                {showCamera && (
                  <div className="mt-3">
                    <CameraScanner
                      onScan={(text) => {
                        setShowCamera(false);
                        setBarcode(text);
                        doScan(text, zone);
                      }}
                      onClose={() => setShowCamera(false)}
                    />
                  </div>
                )}
              </div>

              {/* session feed */}
              <div className="flex min-h-32 flex-1 flex-col border-t border-line">
                <div className="flex items-center justify-between px-5 pb-2 pt-4">
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                    Sesión
                  </span>
                  <span className={`rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ${NUM}`}>
                    {recent.length}
                  </span>
                </div>
                {recent.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 pb-6 text-center">
                    <Package className="h-6 w-6 text-zinc-300" strokeWidth={1.5} />
                    <p className="text-xs text-zinc-400">
                      Lo que guardes en esta sesión aparecerá aquí.
                    </p>
                  </div>
                ) : (
                  <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
                    {recent.map((r) => {
                      const m = levelMeta(r.level);
                      return (
                        <li
                          key={r.id}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-zinc-700">{r.label}</span>
                          <span className={`shrink-0 text-xs text-zinc-400 ${NUM}`}>×{r.quantity}</span>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${NUM}`}
                            style={{ backgroundColor: m.color, color: m.text }}
                          >
                            {r.position ?? r.binCode}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col gap-4 p-5 lg:p-6">
              {/* product */}
              <div className="min-w-0">
                <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                  Producto
                  {scanned.enrichmentStatus === "queued" && (
                    <span className="shimmer ml-2 normal-case tracking-normal">identificando…</span>
                  )}
                </div>
                <div className="mt-0.5 line-clamp-2 text-lg font-bold leading-snug text-ink">
                  {scanned.label}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {scanned.barcode && (
                    <span className={`text-xs text-zinc-400 ${NUM}`}>{scanned.barcode}</span>
                  )}
                  {scanned.category && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                      {scanned.category}
                    </span>
                  )}
                </div>
              </div>

              {/* target bin — the answer */}
              {selectedCell && selectedMeta ? (
                <div
                  className="rounded-2xl px-5 py-4 shadow-md ring-1 ring-black/10"
                  style={{ backgroundColor: selectedMeta.color, color: selectedMeta.text }}
                >
                  <div className={`text-[11px] font-bold uppercase tracking-[0.18em] opacity-80 ${NUM}`}>
                    Guárdalo en
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <span className={`text-[64px] font-bold leading-none ${NUM}`}>
                      {selectedCell.position}
                    </span>
                    <div className="pb-1.5 text-right">
                      <div className={`text-sm font-bold ${NUM}`}>{selectedCell.code}</div>
                      <div className="text-xs font-semibold opacity-85">
                        Nivel {selectedCell.level} · {selectedMeta.name}
                      </div>
                      {scanned.suggestion.stationName && (
                        <div className="text-[11px] opacity-70">{scanned.suggestion.stationName}</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-red-50 px-5 py-4 text-center text-red-700 ring-1 ring-red-200">
                  <div className="text-sm font-semibold">{scanned.suggestion.reason}</div>
                </div>
              )}

              {/* quantity */}
              <div>
                <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                  Cantidad
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bump(-1)}
                    aria-label="Restar 1"
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className={`h-12 flex-1 rounded-xl border border-zinc-300 text-center text-2xl font-bold text-ink outline-none focus:border-ink ${NUM}`}
                  />
                  <button
                    type="button"
                    onClick={() => bump(1)}
                    aria-label="Sumar 1"
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  {[5, 10, 24].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => bump(n)}
                      className={`flex-1 rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-200 ${NUM}`}
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuantity(1)}
                    className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-50"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* meta accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMeta((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-zinc-800"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showMeta ? "rotate-180" : ""}`}
                  />
                  Condición / origen / caducidad
                </button>
                {showMeta && (
                  <div className="mt-2 grid gap-2.5 rounded-xl bg-zinc-50 p-3 ring-1 ring-line">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500">Condición</label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value as Condition)}
                          className={`mt-1 w-full ${field}`}
                        >
                          {CONDITIONS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500">Origen</label>
                        <select
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value as Origin)}
                          className={`mt-1 w-full ${field}`}
                        >
                          {ORIGINS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500">
                        Caducidad (MMYY)
                      </label>
                      <input
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="1226"
                        className={`mt-1 w-full ${field} ${NUM}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* confirm */}
              <div className="mt-auto space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy || !selectedBinId}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-bold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-40"
                >
                  {busy ? "Guardando…" : "Confirmar stow"}
                  {!busy && <ArrowRight className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={resetForNext}
                  className="w-full text-center text-xs font-medium text-zinc-400 transition hover:text-zinc-600"
                >
                  Cancelar y escanear otro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* the wall */}
        <div className="flex flex-1 flex-col p-4 lg:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
              Pared · {ZONE_LABEL[scanned?.suggestion.zone ?? zone]}
            </span>
            {scanned && (
              <span className="text-xs font-medium text-zinc-400">
                Toca otro bin para cambiar
              </span>
            )}
          </div>
          <BinWall
            cells={strip}
            selectedBinId={scanned ? selectedBinId : undefined}
            onSelect={scanned ? setSelectedBinId : undefined}
            fill
          />
        </div>
      </div>

      {/* success toast */}
      {flash && (
        <div className="toast-pop fixed right-4 top-16 z-50 flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          {flash}
        </div>
      )}
    </div>
  );
}
