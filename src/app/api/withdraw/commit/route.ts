// POST /api/withdraw/commit — outbound step 2: take N units of a product OUT,
// allocated across its batches in FEFO order (soonest expiry leaves first).
// Every batch touched is recorded in stock_movements (who/when/what/where) —
// the audit trail the owner asked for. Any warehouse member may withdraw
// (it's a floor operation); the trail is what makes that safe.

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const REASONS = ["vendido", "dañado", "ajuste", "otro"] as const;
type Reason = (typeof REASONS)[number];

interface CommitBody {
  product_id: string;
  quantity: number;
  reason?: Reason;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: CommitBody;
  try {
    body = (await request.json()) as CommitBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const qty = Math.floor(Number(body.quantity));
  const reason: Reason = REASONS.includes(body.reason as Reason)
    ? (body.reason as Reason)
    : "otro";
  if (!body.product_id || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Cantidad no válida" }, { status: 400 });
  }

  const wh = ctx.profile.warehouse_id;
  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("id, name, barcode")
    .eq("id", body.product_id)
    .eq("warehouse_id", wh)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  // FEFO: soonest expiry first, then oldest reception.
  const { data: batches } = await admin
    .from("batches")
    .select("id, quantity, notes, expiration_date, bins(code)")
    .eq("warehouse_id", wh)
    .eq("product_id", product.id)
    .eq("status", "activo")
    .order("expiration_date", { ascending: true, nullsFirst: false })
    .order("reception_date", { ascending: true });

  const available = (batches ?? []).reduce((s, b) => s + b.quantity, 0);
  if (qty > available) {
    return NextResponse.json(
      { error: `Solo hay ${available} unidades disponibles.` },
      { status: 400 },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const breakdown: { bin_code: string | null; taken: number }[] = [];
  const movements: {
    warehouse_id: string;
    product_id: string;
    product_name: string | null;
    barcode: string | null;
    batch_id: string;
    bin_code: string | null;
    type: string;
    quantity: number;
    reason: string;
    operator_id: string;
    operator_name: string | null;
  }[] = [];

  let remaining = qty;
  for (const b of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    const bin = (Array.isArray(b.bins) ? b.bins[0] : b.bins) as { code?: string } | null;
    const binCode = bin?.code ?? null;
    const note = `Retiro ${take} (${reason}) ${stamp}`;
    const notes = b.notes ? `${b.notes}\n${note}` : note;

    // Full take → flip status only (the table CHECK forbids quantity = 0;
    // the last quantity stays as the historical record).
    const update =
      take >= b.quantity
        ? { status: "retirado" as const, notes }
        : { quantity: b.quantity - take, notes };
    const { error } = await admin
      .from("batches")
      .update(update)
      .eq("id", b.id)
      .eq("warehouse_id", wh);
    if (error) {
      return NextResponse.json(
        { error: "No se pudo retirar", detail: error.message },
        { status: 500 },
      );
    }

    breakdown.push({ bin_code: binCode, taken: take });
    movements.push({
      warehouse_id: wh,
      product_id: product.id,
      product_name: product.name,
      barcode: product.barcode,
      batch_id: b.id,
      bin_code: binCode,
      type: "retiro",
      quantity: take,
      reason,
      operator_id: ctx.userId,
      operator_name: ctx.profile.full_name,
    });
    remaining -= take;
  }

  // Audit trail — tolerant of the table not existing yet (pre-migration 0009).
  try {
    await admin.from("stock_movements").insert(movements);
  } catch {
    /* movements table missing — batch notes still carry the trail */
  }

  return NextResponse.json({
    ok: true,
    withdrawn: qty,
    remaining_stock: available - qty,
    breakdown,
  });
}
