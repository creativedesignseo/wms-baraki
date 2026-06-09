"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Package, Plus, ChevronDown } from "lucide-react";
import { FEFOBadge } from "@/components/FEFOBadge";
import { formatMoney } from "@/lib/money";
import type { FefoLevel } from "@/lib/fefo";
import type { Zone, Condition, Origin, BatchStatus, ReviewStatus } from "@/lib/types";

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
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover"
      />
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
      <Package className="h-5 w-5" />
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
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
        No hay productos que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <Thumb src={row.product.image_url} name={row.product.name} />

                <div className="min-w-0 flex-1">
                  <div className="truncate font-[family-name:var(--font-display)] font-semibold text-ink">
                    {row.product.name || "(sin nombre)"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    {row.product.barcode && (
                      <span className="font-mono">{row.product.barcode}</span>
                    )}
                    {row.product.category && (
                      <span className="truncate">· {row.product.category}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  {row.worstFefo !== "none" && <FEFOBadge expiration={fefoExp} />}

                  {row.product.review_status === "approved" ? (
                    <span className="hidden text-sm font-semibold text-ink sm:inline">
                      {formatMoney(row.product.approved_price_local, currency)}
                    </span>
                  ) : (
                    <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 sm:inline">
                      {row.product.review_status === "pending" ? "pendiente" : row.product.review_status}
                    </span>
                  )}

                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-sm font-semibold tabular-nums text-white">
                    {row.totalQty}
                  </span>

                  {expandable && (
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  )}
                </div>
              </button>

              {isOpen && expandable && (
                <div className="bg-slate-50/70 px-4 py-3">
                  <div className="space-y-2">
                    {row.batches.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-100"
                      >
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                          {b.locationName ?? "sin bin"}
                        </span>
                        <span className="font-semibold tabular-nums text-ink">×{b.quantity}</span>
                        <span className="text-slate-500">{b.condition}</span>
                        <span className="text-slate-400">{b.origin}</span>
                        <FEFOBadge expiration={b.expiration_date} />
                        <span className="ml-auto text-xs text-slate-400">
                          {b.operatorName} ·{" "}
                          {new Date(b.reception_date).toLocaleDateString("es-ES")}
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

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} producto(s)
          {filtering && " · algunos lotes ocultos por filtros"}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">
              ← Anterior
            </span>
          )}
          <span className="tabular-nums">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            >
              Siguiente →
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">
              Siguiente →
            </span>
          )}
        </div>
      </div>

      {/* Sortly-style add FAB → go stow a new item */}
      <Link
        href="/stow"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
        aria-label="Recibir / stow"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
