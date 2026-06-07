"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usdToLocal, formatMoney } from "@/lib/money";

export function SettingsClient({
  id,
  name: initialName,
  currency: initialCurrency,
  rate: initialRate,
}: {
  id: string;
  name: string;
  currency: string;
  rate: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState(initialCurrency);
  const [rate, setRate] = useState(String(initialRate));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rateNum = Number(rate);
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
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMsg("Guardado correctamente");
    router.refresh();
  }

  const field =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900";

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Nombre del almacén
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Moneda local
          </label>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="VES"
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Tasa de cambio (1 USD)
          </label>
          <input
            type="number"
            min={0}
            step="0.0001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Vista previa: <strong>1 USD</strong> = {formatMoney(preview, currency || "USD")}
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {msg && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
