"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Package, PackageSearch, Plus, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
}: {
  rows: InventoryRow[];
  currency: string;
  page: number;
  totalPages: number;
  total: number;
  filtering: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const params = useSearchParams();

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
              <button
                type="button"
                onClick={() =>
                  expandable && setOpen((o) => ({ ...o, [row.product.id]: !o[row.product.id] }))
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 sm:px-5"
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
                </div>
              </button>

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
