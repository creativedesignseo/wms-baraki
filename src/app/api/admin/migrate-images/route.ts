// POST /api/admin/migrate-images — one-off backfill (owner only).
// Mirrors existing external/http product images into our https Storage bucket,
// so products enriched before the bucket existed start showing their photo.
// Idempotent: skips images already living in our bucket.

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { mirrorImageToStorage, isStoredImage } from "@/lib/storage";

export async function POST() {
  // API contract: JSON 401/403, never a redirect (proxy.ts skips /api on purpose).
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (ctx.profile.role !== "owner") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const wh = ctx.profile.warehouse_id;
  const admin = createAdminClient();

  const { data: products } = await admin
    .from("products")
    .select("id, image_url")
    .eq("warehouse_id", wh)
    .not("image_url", "is", null)
    .limit(500);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of products ?? []) {
    if (!p.image_url || isStoredImage(p.image_url)) {
      skipped += 1;
      continue;
    }
    const mirrored = await mirrorImageToStorage(p.image_url, wh, p.id);
    if (!mirrored) {
      failed += 1;
      continue;
    }
    await admin
      .from("products")
      .update({ image_url: mirrored })
      .eq("id", p.id)
      .eq("warehouse_id", wh);
    migrated += 1;
  }

  return NextResponse.json({
    ok: true,
    total: products?.length ?? 0,
    migrated,
    skipped,
    failed,
  });
}
