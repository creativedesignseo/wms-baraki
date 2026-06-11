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
  ArrowUp,
  ArrowDown,
  ChevronDown,
  AlertTriangle,
  X,
  ScanLine,
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
  imageUrl: string | null;
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
// Identification that arrives DURING the stow (scan response for known
// products, or the async enrich response seconds later for new ones).
interface EnrichInfo {
  productId: string;
  name: string | null;
  category: string | null;
  inferredZone: Zone | null;
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
const ZONE_CHOICES: Zone[] = ["general", "refrigerado", "congelado"];

const NUM = "font-[family-name:var(--font-num)] tabular-nums";

// Redundant, non-text height cue (color-blind / low-literacy / gloves / 1m read).
function heightCue(level: number): { Icon: typeof ArrowUp; verb: string } {
  if (level <= 1) return { Icon: ArrowDown, verb: "Agáchate · suelo" };
  if (level === 2) return { Icon: ArrowRight, verb: "A la altura · medio" };
  return { Icon: ArrowUp, verb: "Alcanza · alto" };
}

function mmyyToDate(mmyy: string): string | null {
  const m = mmyy.replace(/\D/g, "");
  if (m.length !== 4) return null;
  const month = parseInt(m.slice(0, 2), 10);
  const year = 2000 + parseInt(m.slice(2), 10);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function StowClient({ zones }: { zones: Zone[] }) {
  const [zone, setZone] = useState<Zone>(zones[0] ?? "general");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<Condition>("nuevo");
  const [origin, setOrigin] = useState<Origin>("otro");
  const [expiry, setExpiry] = useState("");

  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showLocSheet, setShowLocSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [showMeta, setShowMeta] = useState(false);
  const [enrichInfo, setEnrichInfo] = useState<EnrichInfo | null>(null);

  // Zone is PRODUCT-driven until the operator explicitly picks one; from then
  // on the selection is sticky (cold-cart workflow) and mismatches only advise.
  const [zoneTouched, setZoneTouched] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const focusBarcode = useCallback(() => {
    requestAnimationFrame(() => barcodeRef.current?.focus());
  }, []);
  useEffect(() => focusBarcode(), [focusBarcode]);

  function resetForNext() {
    setScanned(null);
    setSelectedBinId(null);
    setShowLocSheet(false);
    setBarcode("");
    setQuantity(1);
    setExpiry("");
    setShowMeta(false);
    setEnrichInfo(null);
    setZoneTouched(false);
    focusBarcode();
  }

  // zoneArg = null → the server decides from the product's category (the
  // operator hasn't forced a zone). Returns the EFFECTIVE zone in data.zone.
  const doScan = useCallback(
    async (code: string | null, zoneArg: Zone | null, reuseId?: string | null) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stow/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: code,
          zone: zoneArg ?? undefined,
          product_id: reuseId ?? undefined,
        }),
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
        imageUrl: data.product?.image_url ?? null,
        barcode: data.barcode ?? code,
        enrichmentStatus: data.enrichment_status,
        suggestion: data.suggestion,
      };
      setScanned(s);
      setSelectedBinId(s.suggestion.binId);
      setZone(data.zone);
      setEnrichInfo(
        data.inferred_zone
          ? {
              productId: data.product_id,
              name: data.product?.name ?? null,
              category: data.product?.category ?? null,
              inferredZone: data.inferred_zone,
            }
          : null,
      );
      if (data.enrichment_status === "queued") {
        const pid: string = data.product_id;
        fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: pid }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((e) => {
            if (!e) return;
            setScanned((prev) =>
              prev && prev.productId === pid
                ? {
                    ...prev,
                    label: e.name || prev.label,
                    category: e.category ?? prev.category,
                    enrichmentStatus: e.enrichment_status ?? prev.enrichmentStatus,
                  }
                : prev,
            );
            if (e.name || e.category) {
              setEnrichInfo({
                productId: pid,
                name: e.name ?? null,
                category: e.category ?? null,
                inferredZone: e.inferred_zone ?? null,
              });
            }
          })
          .catch(() => {});
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
      if (barcode.trim()) doScan(barcode.trim(), zoneTouched ? zone : null);
    }
  }

  // explicit operator zone choice (sticky); re-suggest for the SAME product
  // (passing its id avoids creating a duplicate row for no-barcode items).
  function chooseZone(z: Zone) {
    setZoneTouched(true);
    setZone(z);
    if (scanned) doScan(scanned.barcode, z, scanned.productId);
  }

  async function handleConfirm() {
    if (!scanned || !selectedBinId) {
      setError("No hay ubicación seleccionada");
      return;
    }
    // Defense in depth: never save a hand-keyed item before its zone is chosen.
    if (scanned.enrichmentStatus === "manual" && !scanned.category && !zoneTouched) {
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
      if (data.zone_warning) {
        setFlash({ text: data.zone_warning, tone: "warn" });
        setTimeout(() => setFlash(null), 6500);
      } else {
        setFlash({ text: `${scanned.label} ×${quantity} → ${data.bin_code}`, tone: "ok" });
        setTimeout(() => setFlash(null), 2400);
      }
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
          No hay ubicaciones configuradas. Pídele a un gerente que cree estaciones y ubicaciones en el Panel.
        </div>
      </div>
    );
  }

  const strip = scanned?.suggestion.strip ?? [];
  const selectedCell = scanned ? strip.find((c) => c.id === selectedBinId) : undefined;
  const selectedMeta = selectedCell ? levelMeta(selectedCell.level) : null;
  // Zone advisory: identification (live or from the catalog) points elsewhere.
  const adviceZone =
    scanned &&
    enrichInfo &&
    enrichInfo.productId === scanned.productId &&
    enrichInfo.inferredZone &&
    enrichInfo.inferredZone !== scanned.suggestion.zone
      ? enrichInfo.inferredZone
      : null;
  // The system honestly can't decide the zone: a hand-keyed item with no
  // identity and no operator choice yet → ask, don't fake a destination.
  const needsZoneChoice =
    !!scanned &&
    scanned.enrichmentStatus === "manual" &&
    !scanned.category &&
    !zoneTouched;
  const noBin = !!scanned && !needsZoneChoice && !selectedCell;

  const field =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-ink";

  // shared zone chooser (used in the unidentified state and the no-hueco state)
  const zoneChooser = (
    <div className="grid w-full max-w-sm gap-2.5">
      {ZONE_CHOICES.filter((z) => zones.includes(z)).map((z) => (
        <button
          key={z}
          type="button"
          onClick={() => chooseZone(z)}
          className="flex h-[4.5rem] items-center gap-3 rounded-2xl border border-zinc-300 bg-white px-5 text-left transition hover:border-ink hover:bg-zinc-50 active:scale-[0.99]"
        >
          <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${ZONE_DOT[z]}`} />
          <span className="text-xl font-bold text-ink">{ZONE_LABEL[z]}</span>
          <ArrowRight className="ml-auto h-5 w-5 text-zinc-400" />
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      {error && (
        <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 lg:mx-6">
          {error}
        </p>
      )}

      {!scanned ? (
        /* ── IDLE: one target, the scan field ───────────────────────────── */
        <div className="flex flex-1 flex-col items-center">
          <div className="w-full max-w-2xl px-5 pb-6 pt-10 text-center lg:pt-16">
            <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 ${NUM}`}>
              Guardar
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink lg:text-4xl">
              Escanea un producto
            </h1>
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={onBarcodeKeyDown}
              placeholder="Pistola o teclado…"
              className={`mt-6 h-20 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-5 text-center text-xl text-ink outline-none transition focus:border-ink focus:bg-white focus:shadow-[0_0_0_5px_rgba(23,23,26,0.08)] lg:h-24 lg:text-2xl ${NUM}`}
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-ink text-base font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98]"
              >
                <Camera className="h-5 w-5" /> Cámara
              </button>
              <button
                type="button"
                onClick={() => doScan(null, zoneTouched ? zone : null)}
                className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white text-base font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
              >
                <PackagePlus className="h-5 w-5" /> Sin código
              </button>
            </div>
            {showCamera && (
              <div className="mt-4 text-left">
                <CameraScanner
                  onScan={(text) => {
                    setShowCamera(false);
                    setBarcode(text);
                    doScan(text, zoneTouched ? zone : null);
                  }}
                  onClose={() => setShowCamera(false)}
                />
              </div>
            )}
          </div>

          {/* session feed — low weight */}
          <div className="w-full max-w-2xl flex-1 border-t border-line px-5 pt-4">
            <div className="flex items-center justify-between pb-2">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                Guardados en esta sesión
              </span>
              <span className={`rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ${NUM}`}>
                {recent.length}
              </span>
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Package className="h-6 w-6 text-zinc-300" strokeWidth={1.5} />
                <p className="text-xs text-zinc-400">Lo que guardes aparecerá aquí.</p>
              </div>
            ) : (
              <ul className="space-y-1 pb-6">
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
        </div>
      ) : (
        /* ── ORDER: one clear instruction ───────────────────────────────── */
        <div className="flex flex-1 flex-col">
          {/* docked context bar */}
          <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-2 lg:px-6">
            <ScanLine className="h-4 w-4 text-zinc-400" />
            <span className={`text-sm text-zinc-500 ${NUM}`}>{scanned.barcode ?? "Sin código"}</span>
            <button
              type="button"
              onClick={resetForNext}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            >
              <X className="h-3.5 w-3.5" /> Escanear otro
            </button>
          </div>

          {/* zone-mismatch advisory (system note above the order) */}
          {adviceZone && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 lg:px-6">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-sm font-semibold text-amber-900">
                Parece {ZONE_LABEL[adviceZone]}.
                {enrichInfo?.category && (
                  <span className="font-normal text-amber-800/80"> {enrichInfo.category}</span>
                )}
              </span>
              {zones.includes(adviceZone) && (
                <button
                  type="button"
                  onClick={() => chooseZone(adviceZone)}
                  className="ml-auto flex h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white transition hover:bg-amber-700 active:scale-[0.98]"
                >
                  Mover a {ZONE_LABEL[adviceZone]} <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex flex-1 flex-col lg:flex-row">
            {/* FLOOD — the destination */}
            <div className="flex min-h-[44vh] flex-col lg:min-h-0 lg:w-[58%] xl:w-[60%]">
              {needsZoneChoice ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-zinc-50 p-6 text-center">
                  <div>
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                      Sin identificar
                    </div>
                    <div className="mt-1 text-2xl font-bold text-ink">¿A qué zona va?</div>
                    <p className="mt-1 text-sm text-zinc-500">
                      Elige la zona y guárdalo — lo identificamos después.
                    </p>
                  </div>
                  {zoneChooser}
                </div>
              ) : noBin ? (
                <div
                  className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center text-white"
                  style={{ backgroundColor: "#e11931" }}
                >
                  <div>
                    <div className={`text-[11px] font-bold uppercase tracking-[0.18em] opacity-90 ${NUM}`}>
                      Sin hueco
                    </div>
                    <div className="mt-1 text-3xl font-extrabold">
                      No hay sitio en {ZONE_LABEL[scanned.suggestion.zone]}
                    </div>
                    <p className="mt-1 text-sm opacity-90">{scanned.suggestion.reason}</p>
                  </div>
                  <div className="text-sm font-semibold opacity-90">Elige otra zona:</div>
                  {zoneChooser}
                </div>
              ) : selectedCell && selectedMeta ? (
                <div
                  className="deck-rise relative flex flex-1 flex-col justify-center overflow-hidden p-6 lg:p-10"
                  style={{ backgroundColor: selectedMeta.color, color: selectedMeta.text }}
                >
                  {/* zone strap — the ONLY zone encoding: word + dot, inverse pill */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-[0.12em] ${NUM}`}
                      style={{ backgroundColor: selectedMeta.text, color: selectedMeta.color }}
                    >
                      <span className={`h-2 w-2 rounded-full ${ZONE_DOT[scanned.suggestion.zone]}`} />
                      {ZONE_LABEL[scanned.suggestion.zone]}
                    </span>
                    <span className={`text-[13px] font-semibold uppercase tracking-[0.12em] opacity-80 ${NUM}`}>
                      Nivel {selectedCell.level} · {selectedMeta.name}
                    </span>
                  </div>

                  {/* hero number */}
                  <div className={`mt-4 text-[13px] font-bold uppercase tracking-[0.2em] opacity-80 ${NUM}`}>
                    Vé a la ubicación
                  </div>
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                    <span
                      className={`font-bold leading-[0.85] ${NUM}`}
                      style={{ fontSize: "clamp(7rem, 22vw, 17rem)" }}
                    >
                      {selectedCell.position}
                    </span>
                    <div className="pb-3">
                      <div className={`text-2xl font-bold lg:text-3xl ${NUM}`}>{selectedCell.code}</div>
                      {(() => {
                        const cue = heightCue(selectedCell.level);
                        return (
                          <span
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
                            style={{
                              backgroundColor: `${selectedMeta.text}33`,
                              boxShadow: `inset 0 0 0 1px ${selectedMeta.text}55`,
                            }}
                          >
                            <cue.Icon className="h-4 w-4" strokeWidth={2.5} /> {cue.verb}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {scanned.suggestion.stationName && (
                    <div className="mt-4 text-sm font-medium opacity-90">
                      {scanned.suggestion.stationName}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowLocSheet(true)}
                    className="mt-5 inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-sm font-semibold"
                    style={{ backgroundColor: `${selectedMeta.text}26` }}
                  >
                    No es esta ubicación <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center bg-zinc-50 p-6 text-zinc-400">
                  Cargando…
                </div>
              )}
            </div>

            {/* RAIL — what the hand must touch */}
            <div className="flex flex-1 flex-col border-t border-line bg-white p-5 lg:border-l lg:border-t-0 lg:p-6">
              {/* identity */}
              <div className="flex items-start gap-3">
                {scanned.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={scanned.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border border-line bg-zinc-50 object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
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
              </div>

              {/* quantity */}
              <div className="mt-5">
                <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                  Cantidad
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Restar 1"
                    className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className={`h-14 flex-1 rounded-xl border border-zinc-300 text-center text-3xl font-bold text-ink outline-none focus:border-ink ${NUM}`}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Sumar 1"
                    className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  {[5, 10, 24].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuantity((q) => q + n)}
                      className={`h-12 flex-1 rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200 ${NUM}`}
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuantity(1)}
                    className="h-12 flex-1 rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-50"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* meta accordion */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowMeta((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-zinc-800"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMeta ? "rotate-180" : ""}`} />
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
                      <label className="block text-[11px] font-medium text-zinc-500">Caducidad (MMYY)</label>
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
              <div className="sticky bottom-0 mt-auto space-y-2 bg-white pt-4">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy || !selectedBinId || needsZoneChoice}
                  className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-bold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-40"
                >
                  {busy
                    ? "Guardando…"
                    : needsZoneChoice
                      ? "Elige una zona"
                      : "Confirmar y guardar"}
                  {!busy && !needsZoneChoice && <ArrowRight className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* change-location sheet (on demand; the 18-wall never sits on this screen) */}
      {showLocSheet && scanned && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLocSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[34rem] lg:max-h-none lg:rounded-none lg:rounded-l-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">
                Otra ubicación de {ZONE_LABEL[scanned.suggestion.zone]}
              </h2>
              <button
                type="button"
                onClick={() => setShowLocSheet(false)}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <BinWall
              cells={strip}
              selectedBinId={selectedBinId}
              onSelect={(id) => {
                setSelectedBinId(id);
                setShowLocSheet(false);
              }}
            />
            <div className="mt-5 border-t border-line pt-4">
              <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                ¿Va a otra zona?
              </div>
              <div className="flex flex-wrap gap-2">
                {ZONE_CHOICES.filter((z) => zones.includes(z) && z !== scanned.suggestion.zone).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => {
                      chooseZone(z);
                      setShowLocSheet(false);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <span className={`h-2 w-2 rounded-full ${ZONE_DOT[z]}`} /> {ZONE_LABEL[z]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* save toast */}
      {flash && (
        <div
          className={`toast-pop fixed right-4 top-16 z-50 flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl ${
            flash.tone === "warn" ? "bg-amber-600" : "bg-ink"
          }`}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              flash.tone === "warn" ? "bg-white/25" : "bg-emerald-500"
            }`}
          >
            {flash.tone === "warn" ? (
              <AlertTriangle className="h-3 w-3" strokeWidth={3} />
            ) : (
              <Check className="h-3 w-3" strokeWidth={3} />
            )}
          </span>
          {flash.text}
        </div>
      )}
    </div>
  );
}
