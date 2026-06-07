"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QuickNumPad } from "@/components/QuickNumPad";
import { CameraScanner } from "@/components/CameraScanner";
import type {
  Condition,
  Origin,
  ReceivePayload,
  ReceiveResult,
  EnrichmentStatus,
} from "@/lib/types";

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

interface RecentItem {
  batchId: string;
  productId: string;
  label: string;
  quantity: number;
  status: EnrichmentStatus;
  reused: boolean;
}

// MMYY → last day of that month as an ISO date. Empty/invalid → null.
function mmyyToDate(mmyy: string): string | null {
  const m = mmyy.replace(/\D/g, "");
  if (m.length !== 4) return null;
  const month = parseInt(m.slice(0, 2), 10);
  const year = 2000 + parseInt(m.slice(2), 10);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function ScanClient() {
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<Condition>("nuevo");
  const [origin, setOrigin] = useState<Origin>("otro");
  const [expiry, setExpiry] = useState(""); // MMYY
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [noBarcode, setNoBarcode] = useState(false);

  const [showCamera, setShowCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const focusBarcode = useCallback(() => {
    requestAnimationFrame(() => barcodeRef.current?.focus());
  }, []);

  useEffect(() => {
    focusBarcode();
  }, [focusBarcode]);

  function resetForm() {
    setBarcode("");
    setQuantity(1);
    setExpiry("");
    setName("");
    setCategory("");
    setNoBarcode(false);
    // condition & origin stay sticky for speed
    focusBarcode();
  }

  function markStatus(batchId: string, status: EnrichmentStatus) {
    setRecent((prev) =>
      prev.map((r) => (r.batchId === batchId ? { ...r, status } : r)),
    );
  }

  async function handleSave() {
    setError(null);
    if (!noBarcode && !barcode.trim()) {
      setError("Escanea o introduce un código de barras");
      focusBarcode();
      return;
    }
    if (noBarcode && !name.trim()) {
      setError("Indica al menos el nombre del producto");
      return;
    }

    const payload: ReceivePayload = {
      barcode: noBarcode ? null : barcode.trim(),
      quantity,
      condition,
      origin,
      expiration_date: mmyyToDate(expiry),
      name: name.trim() || null,
      category: category.trim() || null,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ReceiveResult & { error?: string };
      if (!res.ok) {
        setError(data.error || "No se pudo guardar");
        setSaving(false);
        return;
      }

      const label =
        payload.name || payload.barcode || "(producto sin nombre)";
      setRecent((prev) =>
        [
          {
            batchId: data.batch_id,
            productId: data.product_id,
            label,
            quantity,
            status: data.enrichment_status,
            reused: data.reused_product,
          },
          ...prev,
        ].slice(0, 20),
      );

      // Fire-and-forget enrichment — never awaited, never blocks the next scan.
      if (data.enrichment_status === "queued") {
        fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: data.product_id,
            batch_id: data.batch_id,
          }),
        })
          .then((r) => r.json())
          .then((j: { enrichment_status?: EnrichmentStatus }) => {
            markStatus(data.batch_id, j.enrichment_status || "failed");
          })
          .catch(() => markStatus(data.batch_id, "failed"));
      }

      setFlash(`Guardado: ${label} ×${quantity}`);
      setTimeout(() => setFlash(null), 2000);
      resetForm();
    } catch {
      setError("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  function onBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // USB gun sends Enter after the code. Don't submit yet — confirm the code
    // and keep the operator on the minimal form. Enter again on the field saves.
    if (e.key === "Enter") {
      e.preventDefault();
      if (barcode.trim()) handleSave();
    }
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIdentifying(true);
    setNoBarcode(true);
    try {
      const base64 = await fileToDataUrl(file);
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });
      const data = (await res.json()) as {
        name?: string | null;
        category?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "No se pudo identificar la foto");
      } else {
        setName(data.name || "");
        setCategory(data.category || "");
      }
    } catch {
      setError("Error al procesar la foto");
    } finally {
      setIdentifying(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* ── form ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Recepción</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              📷 Cámara
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sin código
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPhotoSelected}
              className="hidden"
            />
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Código de barras
        </label>
        <input
          ref={barcodeRef}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={onBarcodeKeyDown}
          disabled={noBarcode}
          placeholder="Escanea con la pistola o teclea…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 font-mono text-lg text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
        />

        {(noBarcode || identifying) && (
          <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-xs font-medium uppercase text-slate-500">
              {identifying ? "Identificando con IA…" : "Producto sin código"}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Nombre
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Categoría
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}

        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700">
            Cantidad
          </label>
          <div className="mt-1">
            <QuickNumPad value={quantity} onChange={setQuantity} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Condición
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as Condition)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Origen
            </label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value as Origin)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900"
            >
              {ORIGINS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Caducidad (MMYY)
            </label>
            <input
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              inputMode="numeric"
              maxLength={5}
              placeholder="1226"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-4 text-lg font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar y siguiente"}
        </button>
      </section>

      {/* ── recent list ── */}
      <aside className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Recibidos en esta sesión
        </h2>
        {flash && (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            ✓ {flash}
          </p>
        )}
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no has recibido nada.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.batchId}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {r.label}
                  </p>
                  <p className="text-xs text-slate-500">×{r.quantity}</p>
                </div>
                <StatusPill status={r.status} reused={r.reused} />
              </li>
            ))}
          </ul>
        )}
      </aside>

      {showCamera && (
        <CameraScanner
          onScan={(text) => {
            setBarcode(text);
            setShowCamera(false);
            focusBarcode();
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

function StatusPill({
  status,
  reused,
}: {
  status: EnrichmentStatus;
  reused: boolean;
}) {
  if (reused)
    return (
      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
        reutilizado
      </span>
    );
  const map: Record<EnrichmentStatus, { label: string; cls: string }> = {
    queued: { label: "enriqueciendo…", cls: "bg-amber-50 text-amber-700" },
    enriched: { label: "enriquecido", cls: "bg-green-50 text-green-700" },
    manual: { label: "manual", cls: "bg-slate-100 text-slate-600" },
    failed: { label: "sin datos", cls: "bg-red-50 text-red-700" },
  };
  const s = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
