"use client";

import { useState } from "react";
import { Check, ClipboardCheck, Loader2, Package, Search, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usdToLocal, formatMoney } from "@/lib/money";
import type { DeepPriceSource, EnrichmentStatus, Product } from "@/lib/types";

const NUM = "font-[family-name:var(--font-num)] tabular-nums";
const KICKER = `text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${NUM}`;
const FIELD =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-ink";

interface Editable extends Product {
  _draftName: string;
  _draftPriceUsd: string;
  _busy?: boolean;
  _deepBusy?: boolean;
  _deepSources?: DeepPriceSource[];
  _deepError?: string | null;
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

  // Manual deep search: web-search-capable model finds a real price with cited
  // sources. Pre-fills the price only when a real source backs it.
  async function deepSearch(item: Editable) {
    patch(item.id, { _deepBusy: true, _deepError: null, _deepSources: undefined });
    try {
      const res = await fetch("/api/deep-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: item.id }),
      });
      const data = (await res.json()) as {
        price_usd?: number | null;
        sources?: DeepPriceSource[];
        error?: string;
      };
      if (!res.ok) {
        patch(item.id, {
          _deepBusy: false,
          _deepError: data.error || "No se pudo buscar el precio",
        });
        return;
      }
      const sources = data.sources ?? [];
      const hasPrice = data.price_usd != null && sources.length > 0;
      patch(item.id, {
        _deepBusy: false,
        _deepSources: sources,
        _deepError: hasPrice ? null : "No se encontró un precio con fuente fiable",
        ...(hasPrice
          ? {
              _draftPriceUsd: String(data.price_usd),
              suggested_price_usd: data.price_usd as number,
            }
          : {}),
      });
    } catch {
      patch(item.id, { _deepBusy: false, _deepError: "Error al buscar el precio" });
    }
  }

  return (
    <div>
      {/* ── page header ──────────────────────────────────────────────────── */}
      <div className="deck-rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={`mb-1 ${KICKER}`}>Gestión · Revisión de precios</div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Cola de aprobación
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Revisa el precio y los datos antes de aprobar. El precio local se
            calcula con la tasa actual (
            <span className={`font-medium text-zinc-700 ${NUM}`}>
              {rate} {currency}/USD
            </span>
            ).
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className={KICKER}>Pendientes</div>
          <div className={`mt-1 text-3xl font-bold leading-none text-ink ${NUM}`}>
            {items.length}
          </div>
        </div>
      </div>

      {/* ── queue ────────────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div
          className="deck-rise rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400"
          style={{ animationDelay: "60ms" }}
        >
          <ClipboardCheck className="mx-auto h-6 w-6 text-zinc-300" strokeWidth={1.8} />
          <p className="mt-3 font-semibold text-zinc-500">
            No hay productos pendientes
          </p>
          <p className="mt-1">
            Los nuevos productos escaneados aparecerán aquí para su revisión.
          </p>
        </div>
      ) : (
        <div className="deck-rise space-y-3" style={{ animationDelay: "60ms" }}>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
          {items.map((item) => {
            const usd =
              item._draftPriceUsd.trim() === "" ? null : Number(item._draftPriceUsd);
            const local = usdToLocal(Number.isNaN(usd as number) ? null : usd, rate);
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                {/* product */}
                <div className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-5">
                  <Thumb src={item.image_url} name={item._draftName || item.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.barcode && (
                        <span className={`text-xs text-zinc-400 ${NUM}`}>
                          {item.barcode}
                        </span>
                      )}
                      <EnrichmentTag status={item.enrichment_status} />
                      {item.category && (
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <label htmlFor={`name-${item.id}`} className="sr-only">
                      Nombre
                    </label>
                    <input
                      id={`name-${item.id}`}
                      value={item._draftName}
                      onChange={(e) => patch(item.id, { _draftName: e.target.value })}
                      placeholder="(sin nombre)"
                      className={`mt-2 w-full font-medium ${FIELD}`}
                    />
                  </div>
                </div>

                {/* prices + decision — big, glanceable numbers */}
                <div className="px-4 py-5 sm:px-5">
                  <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                    {/* price USD — the protagonist, editable for a one-tap approve */}
                    <div>
                      <label htmlFor={`usd-${item.id}`} className={`mb-1.5 block ${KICKER}`}>
                        Precio de venta · USD
                      </label>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-3xl font-semibold text-zinc-300 ${NUM}`}>$</span>
                        <input
                          id={`usd-${item.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={item._draftPriceUsd}
                          onChange={(e) =>
                            patch(item.id, { _draftPriceUsd: e.target.value })
                          }
                          placeholder="0.00"
                          className={`w-48 border-0 border-b-2 border-zinc-200 bg-transparent p-0 text-5xl font-bold leading-none tracking-tight text-ink outline-none transition placeholder:text-zinc-300 focus:border-ink ${NUM}`}
                        />
                      </div>
                    </div>

                    {/* local — derived, big, read-only */}
                    <div>
                      <div className={`mb-1.5 ${KICKER}`}>Local · {currency}</div>
                      <div className={`text-4xl font-bold leading-none text-zinc-500 ${NUM}`}>
                        {formatMoney(local, currency)}
                      </div>
                    </div>
                  </div>

                  {/* provenance + deep search — always honest about the number */}
                  <div>
                    <Provenance
                      suggested={item.suggested_price_usd}
                      reference={item.reference_price_usd}
                    />

                    {/* deep search — only offered when there's no solid suggestion */}
                    {item.suggested_price_usd === null && (
                      <button
                        type="button"
                        disabled={item._deepBusy}
                        onClick={() => deepSearch(item)}
                        className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-[13px] font-semibold text-ink transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50"
                      >
                        {item._deepBusy ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Buscando precio…
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4" strokeWidth={2} /> Búsqueda profunda
                          </>
                        )}
                      </button>
                    )}

                    {item._deepError && (
                      <p className="mt-2 text-[12px] font-medium text-amber-700">
                        {item._deepError}
                      </p>
                    )}

                    {item._deepSources && item._deepSources.length > 0 && (
                      <div className="mt-2 text-[12px] text-zinc-500">
                        <span className="font-medium text-zinc-600">Fuentes:</span>{" "}
                        {item._deepSources.slice(0, 4).map((s, i) => (
                          <span key={s.url}>
                            {i > 0 && " · "}
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-zinc-300 underline-offset-2 hover:text-ink"
                            >
                              {s.merchant || "fuente"}
                            </a>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* decision */}
                  <div className="mt-5 flex gap-2">
                    <button
                      disabled={item._busy}
                      onClick={() => decide(item, "approved")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" strokeWidth={2} />
                      Aprobar
                    </button>
                    <button
                      disabled={item._busy}
                      onClick={() => decide(item, "rejected")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                      Rechazar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Where the number comes from — never claim a price we don't have a source for.
function Provenance({
  suggested,
  reference,
}: {
  suggested: number | null;
  reference: number | null;
}) {
  if (suggested !== null) {
    return (
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
        <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span>
          Sugerido de mercado {formatMoney(suggested, "USD")} · mediana de comercios
          (UPCitemdb)
        </span>
      </div>
    );
  }
  if (reference !== null) {
    return (
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-amber-700">
        <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span>
          Referencia aproximada {formatMoney(reference, "USD")} · poca confianza,
          confirma el precio
        </span>
      </div>
    );
  }
  return (
    <p className="mt-2.5 text-[12px] text-zinc-400">
      Sin referencia automática de mercado — fija el precio de venta.
    </p>
  );
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
        className="h-14 w-14 shrink-0 rounded-xl border border-line bg-white object-contain"
      />
    );
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-zinc-50 text-zinc-300">
      <Package className="h-5 w-5" strokeWidth={1.8} />
    </span>
  );
}

const ENRICHMENT: Record<EnrichmentStatus, { label: string; cls: string }> = {
  queued: { label: "Identificando", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  enriched: { label: "Enriquecido", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  manual: { label: "Manual", cls: "bg-zinc-100 text-zinc-600" },
  failed: { label: "Fallido", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
};

function EnrichmentTag({ status }: { status: EnrichmentStatus }) {
  const meta = ENRICHMENT[status] ?? ENRICHMENT.manual;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  );
}
