"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usdToLocal, formatMoney } from "@/lib/money";
import type { Product } from "@/lib/types";

interface Editable extends Product {
  _draftName: string;
  _draftPriceUsd: string;
  _busy?: boolean;
}

export function ApprovalClient({
  initialProducts,
  rate,
  currency,
}: {
  initialProducts: Product[];
  rate: number;
  currency: string;
}) {
  const [items, setItems] = useState<Editable[]>(
    initialProducts.map((p) => ({
      ...p,
      _draftName: p.name ?? "",
      _draftPriceUsd:
        p.approved_price_usd?.toString() ??
        p.suggested_price_usd?.toString() ??
        "",
    })),
  );
  const [error, setError] = useState<string | null>(null);

  function patch(id: string, changes: Partial<Editable>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }

  async function decide(item: Editable, decision: "approved" | "rejected") {
    setError(null);
    patch(item.id, { _busy: true });
    const supabase = createClient();

    const usd =
      item._draftPriceUsd.trim() === ""
        ? null
        : Number(item._draftPriceUsd);
    if (decision === "approved" && (usd === null || Number.isNaN(usd) || usd < 0)) {
      setError("Introduce un precio USD válido antes de aprobar");
      patch(item.id, { _busy: false });
      return;
    }

    const update =
      decision === "approved"
        ? {
            name: item._draftName.trim() || null,
            approved_price_usd: usd,
            approved_price_local: usdToLocal(usd, rate),
            review_status: "approved" as const,
          }
        : { review_status: "rejected" as const };

    const { error } = await supabase
      .from("products")
      .update(update)
      .eq("id", item.id);

    if (error) {
      setError(error.message);
      patch(item.id, { _busy: false });
      return;
    }
    // remove from the queue
    setItems((prev) => prev.filter((it) => it.id !== item.id));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
        No hay productos pendientes de aprobación. 🎉
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {items.map((item) => {
        const usd =
          item._draftPriceUsd.trim() === "" ? null : Number(item._draftPriceUsd);
        const local = usdToLocal(Number.isNaN(usd as number) ? null : usd, rate);
        return (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-500">
                  {item.barcode && (
                    <span className="font-mono">{item.barcode}</span>
                  )}
                  <EnrichmentTag status={item.enrichment_status} />
                  {item.category && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">
                      {item.category}
                    </span>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Nombre
                  </label>
                  <input
                    value={item._draftName}
                    onChange={(e) =>
                      patch(item.id, { _draftName: e.target.value })
                    }
                    placeholder="(sin nombre)"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Precio USD
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item._draftPriceUsd}
                    onChange={(e) =>
                      patch(item.id, { _draftPriceUsd: e.target.value })
                    }
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Precio local (auto)
                  </label>
                  <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 font-medium text-slate-900">
                    {formatMoney(local, currency)}
                  </div>
                </div>
              </div>

              <div className="flex flex-row gap-2 md:flex-col md:justify-center">
                <button
                  disabled={item._busy}
                  onClick={() => decide(item, "approved")}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Aprobar
                </button>
                <button
                  disabled={item._busy}
                  onClick={() => decide(item, "rejected")}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EnrichmentTag({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: "bg-amber-50 text-amber-700",
    enriched: "bg-green-50 text-green-700",
    manual: "bg-slate-100 text-slate-600",
    failed: "bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 ${map[status] ?? "bg-slate-100"}`}>
      {status}
    </span>
  );
}
