// POST /api/batches/withdraw — take stock OUT of a batch (manager / owner).
// The operator puts stock IN (stow); removing it is a management decision.
// Partial: reduce quantity. Full: quantity 0 + status 'retirado'. The reason
// is appended to notes for traceability.

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const REASONS = ["vendido", "dañado", "ajuste", "otro"] as const;
type Reason = (typeof REASONS)[number];

interface WithdrawBody {
  batch_id: string;
  quantity: number;
  reason?: Reason;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (ctx.profile.role !== "manager" && ctx.profile.role !== "owner") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: WithdrawBody;
  try {
    body = (await request.json()) as WithdrawBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const wh = ctx.profile.warehouse_id;
  const qty = Math.floor(Number(body.quantity));
  const reason: Reason = REASONS.includes(body.reason as Reason)
    ? (body.reason as Reason)
    : "otro";
  if (!body.batch_id || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Cantidad no válida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: batch } = await admin
    .from("batches")
    .select("id, quantity, status, notes, product_id, products(name, barcode), bins(code)")
    .eq("id", body.batch_id)
    .eq("warehouse_id", wh)
    .maybeSingle();
  if (!batch) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }
  if (batch.status !== "activo") {
    return NextResponse.json({ error: "Este lote ya no está activo" }, { status: 409 });
  }
  if (qty > batch.quantity) {
    return NextResponse.json(
      { error: `Solo hay ${batch.quantity} unidades en este lote` },
      { status: 400 },
    );
  }

  const remaining = batch.quantity - qty;
  const stamp = new Date().toISOString().slice(0, 10);
  const note = `Retiro ${qty} (${reason}) ${stamp}`;
  const notes = batch.notes ? `${batch.notes}\n${note}` : note;

  // Full withdrawal → mark 'retirado' (a retired batch is excluded from active
  // stock and from the delete-block count). We keep the last quantity as the
  // historical record because the table CHECK forbids quantity = 0.
  const update =
    remaining <= 0
      ? { status: "retirado" as const, notes }
      : { quantity: remaining, notes };

  const { error } = await admin
    .from("batches")
    .update(update)
    .eq("id", batch.id)
    .eq("warehouse_id", wh);
  if (error) {
    return NextResponse.json(
      { error: "No se pudo retirar", detail: error.message },
      { status: 500 },
    );
  }

  // Audit trail — tolerant of the table not existing yet (pre-migration 0009).
  const prod = (Array.isArray(batch.products) ? batch.products[0] : batch.products) as
    | { name?: string | null; barcode?: string | null }
    | null;
  const bin = (Array.isArray(batch.bins) ? batch.bins[0] : batch.bins) as
    | { code?: string }
    | null;
  try {
    await admin.from("stock_movements").insert({
      warehouse_id: wh,
      product_id: batch.product_id,
      product_name: prod?.name ?? null,
      barcode: prod?.barcode ?? null,
      batch_id: batch.id,
      bin_code: bin?.code ?? null,
      type: "retiro",
      quantity: qty,
      reason,
      operator_id: ctx.userId,
      operator_name: ctx.profile.full_name,
    });
  } catch {
    /* movements table missing — batch notes still carry the trail */
  }

  return NextResponse.json({ ok: true, remaining: Math.max(0, remaining) });
}
