// POST /api/products/delete — delete a product (manager / owner only).
// The operator can correct identity but NEVER delete. Safe: blocked while the
// product holds active stock; otherwise removes its historical batches, the
// product row, and its mirrored Storage image.

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_IMAGES_BUCKET, isStoredImage } from "@/lib/storage";

interface DeleteBody {
  product_id: string;
}

export async function POST(request: Request) {
  // API contract: JSON 401/403, never a redirect (proxy.ts skips /api on purpose).
  // Operator is intentionally excluded — only manager/owner may delete.
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (ctx.profile.role !== "manager" && ctx.profile.role !== "owner") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.product_id) {
    return NextResponse.json({ error: "Falta product_id" }, { status: 400 });
  }

  const wh = ctx.profile.warehouse_id;
  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("id, image_url")
    .eq("id", body.product_id)
    .eq("warehouse_id", wh)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  // Block deletion while physical stock exists.
  const { count: activeCount } = await admin
    .from("batches")
    .select("id", { count: "exact", head: true })
    .eq("warehouse_id", wh)
    .eq("product_id", product.id)
    .eq("status", "activo");
  if ((activeCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Este producto tiene mercancía guardada. Retírala antes de borrarlo." },
      { status: 409 },
    );
  }

  // Remove historical batches first (FK), then the product.
  await admin.from("batches").delete().eq("warehouse_id", wh).eq("product_id", product.id);
  const { error: delErr } = await admin
    .from("products")
    .delete()
    .eq("id", product.id)
    .eq("warehouse_id", wh);
  if (delErr) {
    return NextResponse.json(
      { error: "No se pudo borrar", detail: delErr.message },
      { status: 500 },
    );
  }

  // Best-effort: remove the mirrored image so Storage doesn't accumulate orphans.
  if (isStoredImage(product.image_url)) {
    const marker = `/${PRODUCT_IMAGES_BUCKET}/`;
    const path = product.image_url!.split(marker)[1]?.split("?")[0];
    if (path) {
      await admin.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
