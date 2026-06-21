"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usdToLocal, formatMoney } from "@/lib/money";

const NUM = "font-[family-name:var(--font-num)] tabular-nums";
const LABEL = "block text-[13px] font-medium text-zinc-700";
const INPUT =
  "mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-ink";

export function SettingsClient({
  id,
  name: initialName,
  currency: initialCurrency,
  rate: initialRate,
  margin: initialMargin,
}: {
  id: string;
  name: string;
  currency: string;
  rate: number;
  margin: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState(initialCurrency);
  const [rate, setRate] = useState(String(initialRate));
  const [margin, setMargin] = useState(String(initialMargin));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rateNum = Number(rate);
  const marginNum = Number(margin);
  const preview = usdToLocal(1, Number.isFinite(rateNum) ? rateNum : 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setError("La tasa de cambio debe ser un número mayor que 0");
      return;
    }
    if (!name.trim()) {
      setError("El nombre no puede estar vacío");
      return;
    }
    if (!Number.isFinite(marginNum) || marginNum < 0) {
      setError("El margen debe ser un número ≥ 0");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("warehouses")
      .update({
        name: name.trim(),
        currency_local: currency.trim() || "USD",
        exchange_rate_usd: rateNum,
      })
      .eq("id", id);
    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }
    // Margin is saved separately so it tolerates migration 0011 not being run yet
    // (the column may not exist; the rest still saves).
    const { error: marginErr } = await supabase
      .from("warehouses")
      .update({ default_margin_pct: marginNum })
      .eq("id", id);
    setSaving(false);
    if (marginErr) {
      setMsg(null);
      setError(
        /column|does not exist|schema cache/i.test(marginErr.message)
          ? "Datos guardados, pero el margen necesita la migración 0011 (córrela en Supabase)."
          : marginErr.message,
      );
      return;
    }
    setMsg("Guardado correctamente");
    router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className="deck-rise rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      style={{ animationDelay: "60ms" }}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ink">Datos del almacén</h2>
        <span
          className={`${NUM} text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400`}
        >
          Solo owner
        </span>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div>
          <label htmlFor="wh-name" className={LABEL}>
            Nombre del almacén
          </label>
          <input
            id="wh-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="wh-currency" className={LABEL}>
              Moneda local
            </label>
            <input
              id="wh-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="VES"
              className={`${INPUT} ${NUM} uppercase`}
            />
          </div>
          <div>
            <label htmlFor="wh-rate" className={LABEL}>
              Tasa de cambio (1 USD)
            </label>
            <input
              id="wh-rate"
              type="number"
              min={0}
              step="0.0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={`${INPUT} ${NUM}`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="wh-margin" className={LABEL}>
            Margen de venta por defecto (%)
          </label>
          <input
            id="wh-margin"
            type="number"
            min={0}
            step="1"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="30"
            className={`${INPUT} ${NUM}`}
          />
          <p className="mt-1 text-[12px] text-zinc-400">
            Se aplica al precio sugerido para proponer el precio de venta. El operario
            puede ajustarlo al guardar.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
          <span className="font-[family-name:var(--font-num)] text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Vista previa
          </span>{" "}
          <span className={`${NUM} ml-1 font-semibold text-ink`}>1 USD</span>
          {" = "}
          <span className={`${NUM} font-semibold text-ink`}>
            {formatMoney(preview, currency || "USD")}
          </span>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}
        {msg && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {msg}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t border-line px-5 py-4">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="h-4 w-4" strokeWidth={2} />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
