// POST /api/deep-price — manual "Búsqueda Profunda" from the approval queue.
// Manager/owner only. Uses a web-search-capable model to find a real market
// price WITH cited sources. Persists the suggestion ONLY when a real source
// backs it — never an invented number (same rule as weight).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai";

interface DeepPriceBody {
  product_id: string;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  // Any signed-in warehouse user can trigger a price search — the owner wants the
  // operator to get a suggested price right in the stow screen. It only writes a
  // SUGGESTION (never an approved price) and is scoped to the user's warehouse.

  let body: DeepPriceBody;
  try {
    body = (await request.json()) as DeepPriceBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.product_id) {
    return NextResponse.json({ error: "Falta product_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const warehouseId = ctx.profile.warehouse_id;

  const { data: product } = await supabase
    .from("products")
    .select("id, name, barcode")
    .eq("id", body.product_id)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  if (!product.name) {
    return NextResponse.json(
      { error: "Pon un nombre al producto antes de buscar su precio" },
      { status: 400 },
    );
  }

  try {
    const result = await getAIProvider().deepPriceSearch(
      product.name,
      product.barcode,
    );

    // Persist the suggestion only when a real source backs the price.
    if (result.price_usd != null && result.sources.length > 0) {
      const admin = createAdminClient();
      await admin
        .from("products")
        .update({ suggested_price_usd: result.price_usd })
        .eq("id", product.id)
        .eq("warehouse_id", warehouseId);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "No se pudo buscar el precio",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
