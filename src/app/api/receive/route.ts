// POST /api/receive — CRITICAL PATH. Creates a minimal product+batch and
// returns immediately (sub-second). NO AI / network enrichment here.
// Enrichment is fired separately by the client (fire-and-forget) to /api/enrich.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type {
  ReceivePayload,
  ReceiveResult,
  Condition,
  Origin,
} from "@/lib/types";

const CONDITIONS: Condition[] = ["nuevo", "open_box", "dañado"];
const ORIGINS: Origin[] = ["amazon", "walmart", "local", "otro"];

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: ReceivePayload;
  try {
    body = (await request.json()) as ReceivePayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // ── validate ──────────────────────────────────────────────────────────────
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json(
      { error: "Cantidad debe ser un entero > 0" },
      { status: 400 },
    );
  }
  const condition: Condition = CONDITIONS.includes(body.condition)
    ? body.condition
    : "nuevo";
  const origin: Origin = ORIGINS.includes(body.origin) ? body.origin : "otro";
  const barcode = body.barcode?.trim() || null;
  const expiration_date = body.expiration_date?.trim() || null;

  const supabase = await createClient();
  const warehouseId = ctx.profile.warehouse_id;

  // ── resolve or create the product (reuse by barcode within tenant) ──────────
  let productId: string | null = null;
  let reused = false;
  let enrichmentStatus: ReceiveResult["enrichment_status"] = "queued";

  if (barcode) {
    const { data: existing } = await supabase
      .from("products")
      .select("id, enrichment_status")
      .eq("warehouse_id", warehouseId)
      .eq("barcode", barcode)
      .maybeSingle();
    if (existing) {
      productId = existing.id;
      reused = true;
      enrichmentStatus = existing.enrichment_status;
    }
  }

  if (!productId) {
    // No barcode → operator-identified (vision/manual) → 'manual'.
    // With barcode → pending background enrichment → 'queued'.
    enrichmentStatus = barcode ? "queued" : "manual";
    const { data: created, error: prodErr } = await supabase
      .from("products")
      .insert({
        warehouse_id: warehouseId,
        barcode,
        name: body.name?.trim() || null,
        category: body.category?.trim() || null,
        enrichment_status: enrichmentStatus,
        review_status: "pending",
        created_by: ctx.userId,
      })
      .select("id")
      .single();

    if (prodErr || !created) {
      // Possible race on the partial unique (barcode) index — re-select.
      if (barcode) {
        const { data: retry } = await supabase
          .from("products")
          .select("id, enrichment_status")
          .eq("warehouse_id", warehouseId)
          .eq("barcode", barcode)
          .maybeSingle();
        if (retry) {
          productId = retry.id;
          reused = true;
          enrichmentStatus = retry.enrichment_status;
        }
      }
      if (!productId) {
        return NextResponse.json(
          { error: "No se pudo crear el producto", detail: prodErr?.message },
          { status: 500 },
        );
      }
    } else {
      productId = created.id;
    }
  }

  // ── insert the batch (operator_id always set) ───────────────────────────────
  const { data: batch, error: batchErr } = await supabase
    .from("batches")
    .insert({
      warehouse_id: warehouseId,
      product_id: productId,
      quantity,
      condition,
      origin,
      expiration_date,
      status: "activo",
      operator_id: ctx.userId,
      notes: body.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (batchErr || !batch) {
    return NextResponse.json(
      { error: "No se pudo crear el lote", detail: batchErr?.message },
      { status: 500 },
    );
  }

  const result: ReceiveResult = {
    product_id: productId,
    batch_id: batch.id,
    barcode,
    enrichment_status: enrichmentStatus,
    reused_product: reused,
  };
  return NextResponse.json(result, { status: 200 });
}
