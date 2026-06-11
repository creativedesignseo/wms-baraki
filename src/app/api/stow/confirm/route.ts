// POST /api/stow/confirm — Amazon-style stow step 2. Creates the batch with the
// confirmed (or overridden) bin_id. bin_id is set at INSERT so the operator's RLS
// insert policy validates it belongs to the tenant — no operator UPDATE needed.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { inferZone } from "@/lib/rules/putaway";
import type { Condition, Origin } from "@/lib/types";

const ZONE_LABEL: Record<string, string> = {
  general: "Ambiente",
  refrigerado: "Refrigerado",
  congelado: "Congelado",
  hazmat: "Hazmat",
};

const CONDITIONS: Condition[] = ["nuevo", "open_box", "dañado"];
const ORIGINS: Origin[] = ["amazon", "walmart", "local", "otro"];

interface ConfirmBody {
  product_id: string;
  bin_id: string;
  quantity: number;
  condition: Condition;
  origin: Origin;
  expiration_date: string | null;
  notes?: string | null;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const wh = ctx.profile.warehouse_id;
  const quantity = Number(body.quantity);
  if (!body.product_id || !body.bin_id) {
    return NextResponse.json({ error: "Falta product_id o bin_id" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Cantidad debe ser un entero > 0" }, { status: 400 });
  }
  const condition: Condition = CONDITIONS.includes(body.condition) ? body.condition : "nuevo";
  const origin: Origin = ORIGINS.includes(body.origin) ? body.origin : "otro";
  const expiration_date = body.expiration_date?.trim() || null;

  const supabase = await createClient();

  // Validate the bin belongs to the tenant (defence in depth; RLS also enforces it).
  const { data: bin } = await supabase
    .from("bins")
    .select("id, code, zone")
    .eq("id", body.bin_id)
    .eq("warehouse_id", wh)
    .maybeSingle();
  if (!bin) {
    return NextResponse.json({ error: "Bin no encontrado" }, { status: 404 });
  }

  const { data: batch, error } = await supabase
    .from("batches")
    .insert({
      warehouse_id: wh,
      product_id: body.product_id,
      bin_id: bin.id,
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

  if (error || !batch) {
    return NextResponse.json(
      { error: "No se pudo guardar el lote", detail: error?.message },
      { status: 500 },
    );
  }

  // Zone sanity check AFTER saving (never blocks the operator): if the product
  // has been identified by now and its category points to a different zone,
  // warn — the batch also surfaces in the Panel's relocation alerts.
  let zone_warning: string | null = null;
  const { data: prod } = await supabase
    .from("products")
    .select("category")
    .eq("id", body.product_id)
    .eq("warehouse_id", wh)
    .maybeSingle();
  if (prod?.category) {
    const productZone = inferZone(prod.category, expiration_date !== null);
    if (productZone !== bin.zone) {
      zone_warning = `Este producto parece de ${ZONE_LABEL[productZone] ?? productZone} y quedó en ${bin.code} (${ZONE_LABEL[bin.zone] ?? bin.zone}).`;
    }
  }

  return NextResponse.json(
    { batch_id: batch.id, bin_code: bin.code, zone_warning },
    { status: 200 },
  );
}
