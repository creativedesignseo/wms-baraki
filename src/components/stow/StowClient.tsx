"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function mmyyToDate(mmyy: string): string | null {
  const m = mmyy.replace(/\D/g, "");
  if (m.length !== 4) return null;
  const month = parseInt(m.slice(0, 2), 10);
  const year = 2000 + parseInt(m.slice(2), 10);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function StowClient({ stations }: { stations: StationOpt[] }) {
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

  async function handleScan(code: string | null) {
    if (!stationId) {
      setError("Selecciona una estación primero");
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
        label: data.product?.name || code || "(sin nombre)",
        enrichmentStatus: data.enrichment_status,
        suggestion: data.suggestion,
      };
      setScanned(s);
      setSelectedBinId(s.suggestion.binId);

      // fire-and-forget enrichment (never blocks the stow)
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
        [
          { id: data.batch_id, label: scanned.label, quantity, binCode: data.bin_code },
          ...prev,
        ].slice(0, 20),
      );
      setFlash(`✓ ${scanned.label} ×${quantity} → bin ${data.bin_code}`);
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

  const station = stations.find((s) => s.id === stationId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="mb-3 text-xl font-bold text-slate-900">Stow (guardar)</h1>

        {/* station picker */}
        <label className="block text-sm font-medium text-slate-700">Estación</label>
        <select
          value={stationId}
          onChange={(e) => {
            setStationId(e.target.value);
            resetForNext();
          }}
          className="mt-1 mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-900"
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {ZONE_LABEL[s.zone]}
            </option>
          ))}
        </select>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="rounded-xl bg-slate-900 px-3 py-3 text-base font-semibold text-white active:bg-slate-700"
          >
            📷 Escanear
          </button>
          <button
            type="button"
            onClick={() => handleScan(null)}
            className="rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-700 active:bg-slate-100"
          >
            Sin código
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700">Código de barras</label>
        <input
          ref={barcodeRef}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={onBarcodeKeyDown}
          placeholder="Escanea con la pistola o teclea…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-mono text-lg text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />

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

        {/* quantity + meta */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700">Cantidad</label>
          <div className="mt-1">
            <QuickNumPad value={quantity} onChange={setQuantity} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Condición</label>
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
            <label className="block text-sm font-medium text-slate-700">Origen</label>
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
            <label className="block text-sm font-medium text-slate-700">Caducidad (MMYY)</label>
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

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* stow target — appears after scanning */}
        {scanned && (
          <div className="mt-5 rounded-xl border-2 border-slate-900 p-4">
            <div className="mb-1 text-xs font-medium uppercase text-slate-500">
              Guardar en bin · {station ? ZONE_LABEL[station.zone] : ""}
            </div>
            <p className="mb-3 truncate font-semibold text-slate-900">{scanned.label}</p>
            {scanned.suggestion.binCode ? (
              <p className="mb-2 text-sm text-slate-600">
                Bin sugerido:{" "}
                <span className="font-mono font-bold text-green-700">
                  {scanned.suggestion.binCode}
                </span>{" "}
                <span className="text-slate-400">(toca otro para cambiar)</span>
              </p>
            ) : (
              <p className="mb-2 text-sm text-red-700">{scanned.suggestion.reason}</p>
            )}
            <BinStrip
              cells={scanned.suggestion.strip}
              selectedBinId={selectedBinId}
              onSelect={setSelectedBinId}
            />
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !selectedBinId}
              className="mt-3 w-full rounded-xl bg-green-600 px-4 py-4 text-lg font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Confirmar stow"}
            </button>
          </div>
        )}

        {!scanned && (
          <p className="mt-5 text-center text-sm text-slate-400">
            Escanea un producto para ver a qué bin va.
          </p>
        )}
      </section>

      {/* recent */}
      <aside className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Guardados en esta sesión</h2>
        {flash && (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash}</p>
        )}
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no has guardado nada.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{r.label}</p>
                  <p className="text-xs text-slate-500">×{r.quantity}</p>
                </div>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 font-mono text-xs text-white">
                  {r.binCode}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
