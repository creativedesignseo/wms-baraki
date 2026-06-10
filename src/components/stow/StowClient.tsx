"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Package, Camera, PackagePlus } from "lucide-react";
import { QuickNumPad } from "@/components/QuickNumPad";
import { CameraScanner } from "@/components/CameraScanner";
import { BinStrip, binColor } from "@/components/stow/BinStrip";
import type { BinStripCell } from "@/lib/rules/putaway";
import type { Condition, Origin, EnrichmentStatus, Zone } from "@/lib/types";

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
  refrigerado: "bg-cyan-500",
  congelado: "bg-blue-500",
  hazmat: "bg-amber-500",
};

const NUM = "font-[family-name:var(--font-num)] tabular-nums";
const DISPLAY = "font-[family-name:var(--font-display)]";

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
    focusBarcode();
  }

  const doScan = useCallback(
    async (code: string | null, zoneArg: Zone) => {
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
    },
    [],
  );

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

  if (zones.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        No hay bins configurados. Pídele a un gerente que cree estaciones y bins en el Panel.
      </div>
    );
  }

  const strip = scanned?.suggestion.strip ?? [];
  const selectedIndex = strip.findIndex((c) => c.id === selectedBinId);
  const selectedCode =
    (selectedIndex >= 0 ? strip[selectedIndex].code : null) ??
    scanned?.suggestion.binCode ??
    null;
  const targetColor = selectedIndex >= 0 ? binColor(selectedIndex, strip.length) : null;
  const idleStrip = zoneStrips[zone] ?? [];
  const field =
    "rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900";

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* header: zone selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span className={`h-2 w-2 rounded-full ${ZONE_DOT[zone]}`} />
              Zona de almacenaje
            </div>
            <div className={`text-2xl font-extrabold text-ink ${DISPLAY}`}>{ZONE_LABEL[zone]}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {zones.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => changeZone(z)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  z === zone
                    ? "bg-ink text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {ZONE_LABEL[z]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 py-5">
          {flash && (
            <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-center text-base font-semibold text-green-700 ring-1 ring-green-200">
              ✓ {flash}
            </p>
          )}

          {!scanned ? (
            <div className="flex flex-1 flex-col gap-8 lg:grid lg:grid-cols-[minmax(320px,26rem)_1fr]">
              {/* left: scan controls */}
              <div>
                <div className="py-4 text-center lg:text-left">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 lg:mx-0">
                    <Package className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                  </div>
                  <h1 className={`text-3xl font-extrabold text-ink ${DISPLAY}`}>
                    Escanea un producto
                  </h1>
                  <p className="mt-1 text-slate-500">
                    Irá a un bin de <strong className="text-slate-700">{ZONE_LABEL[zone]}</strong>
                    {" "}· cámbialo arriba si es frío/congelado
                  </p>
                </div>

                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={onBarcodeKeyDown}
                  placeholder="Escanea con la pistola o teclea…"
                  className={`w-full rounded-xl border-2 border-slate-300 px-4 py-4 text-center text-xl text-slate-900 outline-none focus:border-brand ${NUM}`}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-ink px-3 py-3 text-base font-semibold text-white active:opacity-90"
                  >
                    <Camera className="h-5 w-5" /> Cámara
                  </button>
                  <button
                    type="button"
                    onClick={() => doScan(null, zone)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-700 active:bg-slate-100"
                  >
                    <PackagePlus className="h-5 w-5" /> Sin código
                  </button>
                </div>
              </div>

              {/* right: bin wall (fills the screen on a work monitor) */}
              {idleStrip.length > 0 && (
                <div className="flex flex-col">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Bins de {ZONE_LABEL[zone]}
                  </div>
                  <BinStrip cells={idleStrip} fill />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-8 lg:grid lg:grid-cols-[minmax(320px,26rem)_1fr]">
              {/* left: product + actions */}
              <div className="space-y-5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Producto {scanned.enrichmentStatus === "queued" && "· identificando…"}
                  </div>
                  <div className="truncate text-xl font-bold text-ink">{scanned.label}</div>
                  {scanned.barcode && (
                    <div className={`text-sm text-slate-400 ${NUM}`}>{scanned.barcode}</div>
                  )}
                  {scanned.category && (
                    <div className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {scanned.category}
                    </div>
                  )}
                </div>

                {selectedCode ? (
                  <div
                    className="rounded-2xl px-6 py-5 text-center text-white shadow-md ring-1 ring-black/10"
                    style={{ backgroundColor: targetColor ?? "#16a34a" }}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wide opacity-90">Guardar en</div>
                    <div className={`text-5xl font-extrabold leading-tight drop-shadow ${NUM}`}>
                      {selectedCode}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-red-50 px-6 py-4 text-center text-red-700 ring-1 ring-red-200">
                    <div className="text-sm font-semibold">{scanned.suggestion.reason}</div>
                  </div>
                )}

                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Cantidad</div>
                  <QuickNumPad value={quantity} onChange={setQuantity} />
                </div>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy || !selectedBinId}
                  className="w-full rounded-2xl bg-green-600 px-4 py-5 text-xl font-extrabold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {busy ? "Guardando…" : "Confirmar stow"}
                </button>
              </div>

              {/* right: bin wall */}
              <div className="flex flex-col gap-5">
                <div className="flex flex-col">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Toca otro bin para cambiar
                  </div>
                  <BinStrip
                    cells={scanned.suggestion.strip}
                    selectedBinId={selectedBinId}
                    onSelect={setSelectedBinId}
                    fill
                  />
                </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowMeta((v) => !v)}
                  className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
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
                        className={`mt-1 w-full ${field}`}
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
                        className={`mt-1 w-full ${field}`}
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
                        className={`mt-1 w-full ${field} ${NUM}`}
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
                doScan(text, zone);
              }}
              onClose={() => setShowCamera(false)}
            />
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Guardados en esta sesión ({recent.length})
          </h2>
          <ul className="space-y-1.5">
            {recent.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-slate-700">
                  {r.label} <span className="text-slate-400">×{r.quantity}</span>
                </span>
                <span className={`ml-2 shrink-0 rounded-full bg-ink px-2 py-0.5 text-xs text-white ${NUM}`}>
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
