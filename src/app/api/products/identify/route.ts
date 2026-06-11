// POST /api/products/identify — operator-facing IDENTITY edit.
// In a random-liquidation warehouse the operator holds the physical item, so
// they (not just the manager) can correct what classifies & locates a product:
// NAME, CATEGORY and BARCODE — never price/approval (that stays in /approval).
//
// Uses the service-role client (operators have no UPDATE on products by RLS,
// same pattern as /api/enrich), scoped explicitly to the caller's warehouse.

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

interface IdentifyBody {
  product_id: string;
  name?: string | null;
  category?: string | null;
  barcode?: string | null;
  weight?: number | string | null; // kg
  volume?: number | string | null; // L
}

// Parse an operator-typed measurement: a non-negative number, else null.
// Never invents a value — empty/invalid clears the field.
function parseMeasure(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function POST(request: Request) {
  const ctx = await requireRole("operator", "manager", "owner");

  let body: IdentifyBody;
  try {
    body = (await request.json()) as IdentifyBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.product_id) {
    return NextResponse.json({ error: "Falta product_id" }, { status: 400 });
  }

  const wh = ctx.profile.warehouse_id;
  const admin = createAdminClient();

  // Confirm the product belongs to the caller's tenant (RLS is off here).
  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("id", body.product_id)
    .eq("warehouse_id", wh)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  // Whitelist: ONLY identity fields. Price, review_status, approvals are never
  // touched here — that authority belongs to the manager in /approval.
  const name = body.name?.trim() || null;
  const category = body.category?.trim() || null;
  const barcode = body.barcode?.trim() || null;

  const update: ProductUpdate = {
    name,
    category,
    barcode,
    // weight (kg) / volume (L): operator-measured placement hints. Only written
    // when the key is present in the request, so editing the name alone never
    // wipes a known weight. Still never invented — empty clears to null.
    ...("weight" in body ? { weight: parseMeasure(body.weight) } : {}),
    ...("volume" in body ? { volume: parseMeasure(body.volume) } : {}),
    // A hand-corrected product counts as manually identified.
    enrichment_status: "manual",
  };

  const { error } = await admin
    .from("products")
    .update(update)
    .eq("id", product.id)
    .eq("warehouse_id", wh);

  if (error) {
    // Unique (warehouse_id, barcode) collision → another product owns it.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ese código de barras ya está en otro producto." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "No se pudo guardar", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
