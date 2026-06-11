// POST /api/withdraw/lookup — outbound step 1: scan a barcode, see the product
// and its active stock (batches in FEFO order, soonest expiry first), so the
// operator confirms WHAT is being withdrawn before committing quantities.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

interface LookupBody {
  barcode: string;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const barcode = body.barcode?.trim();
  if (!barcode) {
    return NextResponse.json({ error: "Falta el código de barras" }, { status: 400 });
  }

  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  const { data: product } = await supabase
    .from("products")
    .select("id, name, barcode, category, image_url")
    .eq("warehouse_id", wh)
    .eq("barcode", barcode)
    .maybeSingle();
  if (!product) {
    return NextResponse.json(
      { error: "No existe ningún producto con ese código en este almacén." },
      { status: 404 },
    );
  }

  // Active batches in FEFO order: soonest expiry first, then oldest reception.
  const { data: batches } = await supabase
    .from("batches")
    .select("id, quantity, expiration_date, reception_date, bins(code, level)")
    .eq("warehouse_id", wh)
    .eq("product_id", product.id)
    .eq("status", "activo")
    .order("expiration_date", { ascending: true, nullsFirst: false })
    .order("reception_date", { ascending: true });

  const rows = (batches ?? []).map((b) => {
    const bin = (Array.isArray(b.bins) ? b.bins[0] : b.bins) as
      | { code?: string; level?: number | null }
      | null;
    return {
      id: b.id,
      quantity: b.quantity,
      expiration_date: b.expiration_date,
      bin_code: bin?.code ?? null,
      bin_level: bin?.level ?? null,
    };
  });
  const total = rows.reduce((s, b) => s + b.quantity, 0);

  return NextResponse.json({ product, total, batches: rows });
}
