"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
        No hay productos que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Caducidad</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isOpen = open[row.product.id];
              return (
                <FragmentRow
                  key={row.product.id}
                  row={row}
                  isOpen={isOpen}
                  currency={currency}
                  onToggle={() =>
                    setOpen((o) => ({ ...o, [row.product.id]: !o[row.product.id] }))
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} producto(s)
          {filtering && " · algunos lotes ocultos por filtros de lote"}
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
          <span>
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
    </div>
  );
}

function FragmentRow({
  row,
  isOpen,
  currency,
  onToggle,
}: {
  row: InventoryRow;
  isOpen: boolean;
  currency: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <td className="px-4 py-3">
          <div className="font-medium text-slate-900">
            {row.product.name || "(sin nombre)"}
          </div>
          {row.product.barcode && (
            <div className="font-mono text-xs text-slate-400">
              {row.product.barcode}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-slate-600">
          {row.product.category || "—"}
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-900">
          {row.totalQty}
        </td>
        <td className="px-4 py-3">
          {row.worstFefo === "none" ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            <FEFOBadge
              expiration={
                row.batches.find((b) => b.expiration_date)?.expiration_date ?? null
              }
            />
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {row.product.review_status === "approved" ? (
            <span className="font-medium text-slate-900">
              {formatMoney(row.product.approved_price_local, currency)}
            </span>
          ) : (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
              {row.product.review_status}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-slate-400">
          {row.batches.length > 0 ? (isOpen ? "▲" : `▼ ${row.batches.length}`) : ""}
        </td>
      </tr>
      {isOpen && row.batches.length > 0 && (
        <tr>
          <td colSpan={6} className="bg-slate-50 px-4 py-3">
            <table className="w-full text-xs">
              <thead className="text-left uppercase text-slate-400">
                <tr>
                  <th className="py-1 pr-4">Cant.</th>
                  <th className="py-1 pr-4">Condición</th>
                  <th className="py-1 pr-4">Origen</th>
                  <th className="py-1 pr-4">Ubicación</th>
                  <th className="py-1 pr-4">Caducidad</th>
                  <th className="py-1 pr-4">Operario</th>
                  <th className="py-1 pr-4">Recepción</th>
                </tr>
              </thead>
              <tbody>
                {row.batches.map((b) => (
                  <tr key={b.id} className="border-t border-slate-200">
                    <td className="py-1.5 pr-4 font-semibold text-slate-900">
                      {b.quantity}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-600">{b.condition}</td>
                    <td className="py-1.5 pr-4 text-slate-600">{b.origin}</td>
                    <td className="py-1.5 pr-4 text-slate-600">
                      {b.locationName ? (
                        <>
                          {b.locationName}
                          {b.zone && (
                            <span className="ml-1 text-slate-400">({b.zone})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">sin asignar</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4">
                      <FEFOBadge expiration={b.expiration_date} />
                    </td>
                    <td className="py-1.5 pr-4 text-slate-600">{b.operatorName}</td>
                    <td className="py-1.5 pr-4 text-slate-500">
                      {new Date(b.reception_date).toLocaleDateString("es-ES")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
