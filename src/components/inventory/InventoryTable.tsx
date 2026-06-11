"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package,
  PackageSearch,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  PackageMinus,
  X,
} from "lucide-react";
import { FEFOBadge } from "@/components/FEFOBadge";
import { formatMoney } from "@/lib/money";
import type { FefoLevel } from "@/lib/fefo";
import type { Zone, Condition, Origin, BatchStatus, ReviewStatus } from "@/lib/types";

const NUM = "font-[family-name:var(--font-num)] tabular-nums";

export interface InventoryRow {
  product: {
    id: string;
    name: string | null;
    barcode: string | null;
    category: string | null;
    image_url: string | null;
    approved_price_usd: number | null;
    approved_price_local: number | null;
    review_status: ReviewStatus;
  };
  totalQty: number;
  worstFefo: FefoLevel;
  batches: Array<{
    id: string;
    quantity: number;
    condition: Condition;
    origin: Origin;
    expiration_date: string | null;
    reception_date: string;
    status: BatchStatus;
    locationName: string | null;
    zone: Zone | null;
    operatorName: string;
  }>;
}

function Thumb({ src, name }: { src: string | null; name: string | null }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-lg border border-line bg-white object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-zinc-100 text-zinc-400">
      <Package className="h-4 w-4" strokeWidth={1.8} />
    </span>
  );
}

export function InventoryTable({
  rows,
  currency,
  page,
  totalPages,
  total,
  filtering,
  canManage = false,
}: {
  rows: InventoryRow[];
  currency: string;
  page: number;
  totalPages: number;
  total: number;
  filtering: boolean;
  canManage?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [withdraw, setWithdraw] = useState<{
    batchId: string;
    max: number;
    productName: string | null;
  } | null>(null);
  const [wQty, setWQty] = useState("");
  const [wReason, setWReason] = useState("vendido");
  const [wBusy, setWBusy] = useState(false);
  const [wError, setWError] = useState<string | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  function openWithdraw(batchId: string, max: number, productName: string | null) {
    setWithdraw({ batchId, max, productName });
    setWQty(String(max));
    setWReason("vendido");
    setWError(null);
  }

  async function doWithdraw() {
    if (!withdraw) return;
    const qty = parseInt(wQty, 10);
    if (!Number.isFinite(qty) || qty <= 0 || qty > withdraw.max) {
      setWError(`Cantidad entre 1 y ${withdraw.max}`);
      return;
    }
    setWBusy(true);
    setWError(null);
    try {
      const res = await fetch("/api/batches/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: withdraw.batchId, quantity: qty, reason: wReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWError(data.error || "No se pudo retirar");
        return;
      }
      setWithdraw(null);
      router.refresh();
    } catch {
      setWError("Error de red");
    } finally {
      setWBusy(false);
    }
  }

  // manager/owner only — delete a product (blocked server-side if it has stock).
  async function deleteProduct(id: string, name: string | null) {
    if (!window.confirm(`¿Borrar "${name || "(sin nombre)"}"? No se puede deshacer.`)) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 = has stock → open the product so its batches (with "Retirar") show
        if (res.status === 409) setOpen((o) => ({ ...o, [id]: true }));
        window.alert(data.error || "No se pudo borrar");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Error de red al borrar");
    } finally {
      setDeleting(null);
    }
  }

  function pageUrl(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `/inventory?${next.toString()}`;
  }

  if (rows.length === 0) {
    return (
      <div
        className="deck-rise rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400"
        style={{ animationDelay: "120ms" }}
      >
        <PackageSearch className="mx-auto mb-3 h-6 w-6 text-zinc-300" strokeWidth={1.8} />
        No hay productos que coincidan con los filtros.
      </div>
    );
  }

  const pagerOn =
    "inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]";
  const pagerOff =
    "inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-zinc-300";

  return (
    <div className="relative">
      <div
        className="deck-rise divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        style={{ animationDelay: "120ms" }}
      >
        {rows.map((row) => {
          const isOpen = open[row.product.id];
          const expandable = row.batches.length > 0;
          const fefoExp = row.batches.find((b) => b.expiration_date)?.expiration_date ?? null;
          return (
            <div key={row.product.id}>
              <div
                onClick={() =>
                  expandable && setOpen((o) => ({ ...o, [row.product.id]: !o[row.product.id] }))
                }
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 sm:px-5 ${
                  expandable ? "cursor-pointer" : ""
                }`}
              >
                <Thumb src={row.product.image_url} name={row.product.name} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {row.product.name || "(sin nombre)"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                    {row.product.barcode && (
                      <span className={NUM}>{row.product.barcode}</span>
                    )}
                    {row.product.category && (
                      <span className="truncate">· {row.product.category}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  {row.worstFefo !== "none" && <FEFOBadge expiration={fefoExp} />}

                  {row.product.review_status === "approved" ? (
                    <span className={`hidden text-sm font-semibold text-ink sm:inline ${NUM}`}>
                      {formatMoney(row.product.approved_price_local, currency)}
                    </span>
                  ) : (
                    <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 sm:inline">
                      {row.product.review_status === "pending" ? "pendiente" : row.product.review_status}
                    </span>
                  )}

                  <span className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className={`text-sm font-bold text-ink ${NUM}`}>{row.totalQty}</span>
                    <span className="text-[11px] font-medium text-zinc-400">uds</span>
                  </span>

                  {expandable && (
                    <ChevronDown
                      className={`h-4 w-4 text-zinc-400 transition ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={1.8}
                    />
                  )}

                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProduct(row.product.id, row.product.name);
                      }}
                      disabled={deleting === row.product.id}
                      aria-label="Borrar producto"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>

              {isOpen && expandable && (
                <div className="border-t border-line bg-zinc-50/70 px-4 py-3 sm:px-5">
                  <div className="space-y-2">
                    {row.batches.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm"
                      >
                        <span
                          className={`rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 ${NUM}`}
                        >
                          {b.locationName ?? "sin ubicación"}
                        </span>
                        <span className={`text-sm font-bold text-ink ${NUM}`}>×{b.quantity}</span>
                        <span className="text-xs text-zinc-500">{b.condition}</span>
                        <span className="text-xs text-zinc-400">{b.origin}</span>
                        <FEFOBadge expiration={b.expiration_date} />
                        <span className="ml-auto text-xs text-zinc-400">
                          {b.operatorName} ·{" "}
                          <span className={NUM}>
                            {new Date(b.reception_date).toLocaleDateString("es-ES")}
                          </span>
                        </span>
                        {canManage && b.status === "activo" && (
                          <button
                            type="button"
                            onClick={() => openWithdraw(b.id, b.quantity, row.product.name)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                          >
                            <PackageMinus className="h-3.5 w-3.5" /> Retirar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
        <span>
          <span className={`font-semibold text-zinc-700 ${NUM}`}>{total}</span> producto(s)
          {filtering && " · algunos lotes ocultos por filtros"}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={pageUrl(page - 1)} className={pagerOn}>
              <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
              Anterior
            </Link>
          ) : (
            <span className={pagerOff}>
              <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
              Anterior
            </span>
          )}
          <span className={`text-xs text-zinc-500 ${NUM}`}>
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageUrl(page + 1)} className={pagerOn}>
              Siguiente
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          ) : (
            <span className={pagerOff}>
              Siguiente
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </span>
          )}
        </div>
      </div>

      {/* withdraw stock sheet (manager/owner) */}
      {withdraw && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setWithdraw(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5 shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[26rem] lg:rounded-none lg:rounded-l-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Retirar mercancía</h3>
              <button
                type="button"
                onClick={() => setWithdraw(null)}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-zinc-500">
              {withdraw.productName || "(sin nombre)"} ·{" "}
              <span className={NUM}>{withdraw.max}</span> uds disponibles en este lote.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Cantidad a retirar
                </label>
                <input
                  type="number"
                  min={1}
                  max={withdraw.max}
                  value={wQty}
                  onChange={(e) => setWQty(e.target.value)}
                  className={`h-12 w-full rounded-xl border border-zinc-300 px-3 text-base text-ink outline-none transition focus:border-ink ${NUM}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Motivo
                </label>
                <select
                  value={wReason}
                  onChange={(e) => setWReason(e.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-ink outline-none transition focus:border-ink"
                >
                  <option value="vendido">Vendido</option>
                  <option value="dañado">Dañado</option>
                  <option value="ajuste">Ajuste de inventario</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              {wError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
                  {wError}
                </p>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setWithdraw(null)}
                className="h-12 flex-1 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doWithdraw}
                disabled={wBusy}
                className="inline-flex h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-ink text-sm font-bold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50"
              >
                <PackageMinus className="h-4 w-4" /> {wBusy ? "Retirando…" : "Retirar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sortly-style add FAB → go stow a new item (the one brand-red accent) */}
      <Link
        href="/stow"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_20px_rgba(225,25,49,0.4)] transition hover:bg-brand-dark active:scale-95"
        aria-label="Guardar mercancía"
      >
        <Plus className="h-6 w-6" strokeWidth={2} />
      </Link>
    </div>
  );
}
