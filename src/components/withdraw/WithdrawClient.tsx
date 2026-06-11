"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Minus,
  Plus,
  ArrowRight,
  PackageMinus,
  Package,
  X,
} from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { FEFOBadge } from "@/components/FEFOBadge";
import { levelMeta } from "@/lib/levels";

interface FoundBatch {
  id: string;
  quantity: number;
  expiration_date: string | null;
  bin_code: string | null;
  bin_level: number | null;
}
interface Found {
  product: {
    id: string;
    name: string | null;
    barcode: string | null;
    category: string | null;
    image_url: string | null;
  };
  total: number;
  batches: FoundBatch[];
}
interface RecentItem {
  id: string;
  label: string;
  quantity: number;
  detail: string;
}

const NUM = "font-[family-name:var(--font-num)] tabular-nums";

export function WithdrawClient() {
  const [barcode, setBarcode] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("vendido");
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
    setFound(null);
    setBarcode("");
    setQuantity(1);
    setReason("vendido");
    focusBarcode();
  }

  const doLookup = useCallback(async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/withdraw/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo buscar");
        return;
      }
      if ((data.total ?? 0) <= 0) {
        setError(
          `"${data.product?.name || code}" no tiene stock activo en el almacén.`,
        );
        return;
      }
      setFound(data);
      setQuantity(1);
    } catch {
      setError("Error de red al buscar");
    } finally {
      setBusy(false);
    }
  }, []);

  function onBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (barcode.trim()) doLookup(barcode.trim());
    }
  }

  async function handleConfirm() {
    if (!found) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/withdraw/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: found.product.id,
          quantity,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo retirar");
        return;
      }
      navigator.vibrate?.(120);
      const detail = (data.breakdown as { bin_code: string | null; taken: number }[])
        .map((b) => `${b.taken} de ${b.bin_code ?? "—"}`)
        .join(" · ");
      setRecent((prev) =>
        [
          {
            id: `${Date.now()}`,
            label: found.product.name || found.product.barcode || "(sin nombre)",
            quantity,
            detail,
          },
          ...prev,
        ].slice(0, 30),
      );
      setFlash(`Retiradas ${quantity} uds — ${detail}`);
      setTimeout(() => setFlash(null), 4000);
      resetForNext();
    } catch {
      setError("Error de red al retirar");
    } finally {
      setBusy(false);
    }
  }

  const bump = (n: number) =>
    setQuantity((q) => Math.min(found?.total ?? 1, Math.max(1, q + n)));

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="w-full max-w-2xl px-5 pb-6 pt-10 lg:pt-14">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {!found ? (
          <>
            {/* scan-first idle */}
            <div className="text-center">
              <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 ${NUM}`}>
                Retirar
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink lg:text-4xl">
                Escanea el producto a retirar
              </h1>
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={onBarcodeKeyDown}
                placeholder="Pistola o teclado…"
                className={`mt-6 h-20 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-5 text-center text-xl text-ink outline-none transition focus:border-ink focus:bg-white focus:shadow-[0_0_0_5px_rgba(23,23,26,0.08)] lg:h-24 lg:text-2xl ${NUM}`}
              />
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98]"
              >
                <Camera className="h-5 w-5" /> Cámara
              </button>
              {showCamera && (
                <div className="mt-4 text-left">
                  <CameraScanner
                    onScan={(text) => {
                      setShowCamera(false);
                      setBarcode(text);
                      doLookup(text);
                    }}
                    onClose={() => setShowCamera(false)}
                  />
                </div>
              )}
            </div>

            {/* session feed */}
            <div className="mt-8 border-t border-line pt-4">
              <div className="flex items-center justify-between pb-2">
                <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                  Retirados en esta sesión
                </span>
                <span className={`rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ${NUM}`}>
                  {recent.length}
                </span>
              </div>
              {recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <PackageMinus className="h-6 w-6 text-zinc-300" strokeWidth={1.5} />
                  <p className="text-xs text-zinc-400">Lo que retires aparecerá aquí.</p>
                </div>
              ) : (
                <ul className="space-y-1 pb-6">
                  {recent.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600">
                        <PackageMinus className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-zinc-700">{r.label}</span>
                      <span className={`shrink-0 text-xs text-zinc-400 ${NUM}`}>
                        ×{r.quantity} · {r.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          /* found: confirm quantity + reason */
          <div className="deck-rise">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 ${NUM}`}>
                Retirar
              </span>
              <button
                type="button"
                onClick={resetForNext}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
              >
                <X className="h-3.5 w-3.5" /> Escanear otro
              </button>
            </div>

            {/* product */}
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
              {found.product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={found.product.image_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg border border-line bg-zinc-50 object-contain"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-zinc-100 text-zinc-400">
                  <Package className="h-6 w-6" strokeWidth={1.5} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-lg font-bold leading-snug text-ink">
                  {found.product.name || "(sin nombre)"}
                </div>
                {found.product.barcode && (
                  <div className={`text-xs text-zinc-400 ${NUM}`}>{found.product.barcode}</div>
                )}
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold text-ink ${NUM}`}>{found.total}</span>
                  <span className="text-xs font-medium text-zinc-400">
                    uds en {found.batches.length} ubicación(es)
                  </span>
                </div>
              </div>
            </div>

            {/* batches in FEFO order */}
            <div className="mt-3 space-y-1.5">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                Saldrá primero lo que caduca antes
              </span>
              {found.batches.map((b, i) => {
                const m = levelMeta(b.bin_level ?? 1);
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-sm"
                  >
                    <span className={`w-5 text-center text-xs font-bold text-zinc-300 ${NUM}`}>
                      {i + 1}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${NUM}`}
                      style={{ backgroundColor: m.color, color: m.text }}
                    >
                      {b.bin_code ?? "—"}
                    </span>
                    <span className={`font-bold text-ink ${NUM}`}>×{b.quantity}</span>
                    <span className="ml-auto">
                      <FEFOBadge expiration={b.expiration_date} />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* quantity + reason */}
            <div className="mt-4">
              <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                Cantidad a retirar
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => bump(-1)}
                  aria-label="Restar 1"
                  className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={found.total}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.min(found.total, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                  className={`h-14 flex-1 rounded-xl border border-zinc-300 text-center text-3xl font-bold text-ink outline-none focus:border-ink ${NUM}`}
                />
                <button
                  type="button"
                  onClick={() => bump(1)}
                  aria-label="Sumar 1"
                  className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                {[5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => bump(n)}
                    className={`h-12 flex-1 rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200 ${NUM}`}
                  >
                    +{n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuantity(found.total)}
                  className={`h-12 flex-1 rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200 ${NUM}`}
                >
                  Todo ({found.total})
                </button>
              </div>

              <div className={`mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`}>
                Motivo
              </div>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-ink outline-none transition focus:border-ink"
              >
                <option value="vendido">Vendido</option>
                <option value="dañado">Dañado</option>
                <option value="ajuste">Ajuste de inventario</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="mt-5 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-bold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? "Retirando…" : `Confirmar retiro de ${quantity}`}
              {!busy && <ArrowRight className="h-5 w-5" />}
            </button>
          </div>
        )}
      </div>

      {/* toast */}
      {flash && (
        <div className="toast-pop fixed right-4 top-16 z-50 flex max-w-md items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          {flash}
        </div>
      )}
    </div>
  );
}
