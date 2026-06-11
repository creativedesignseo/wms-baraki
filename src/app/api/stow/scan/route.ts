// POST /api/stow/scan — stow step 1 (read/suggest, no batch yet).
// Resolves/creates the minimal product and suggests a bin. The ZONE is driven by
// the product (default "general"/ambiente for non-perishables), not by a fixed
// station — the operator can override the zone for cold items. The client fires
// /api/enrich fire-and-forget; the batch is created by /api/stow/confirm.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { suggestBin, inferZone, type BinForStow } from "@/lib/rules/putaway";
import type { Zone, EnrichmentStatus } from "@/lib/types";

const ZONES: Zone[] = ["general", "refrigerado", "congelado", "hazmat"];

interface ScanBody {
  barcode: string | null;
  zone?: Zone; // optional operator override; otherwise inferred from product
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: ScanBody;
  try {
    body = (await request.json()) as ScanBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const barcode = body.barcode?.trim() || null;

  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  // ── resolve or create the product (reuse by barcode within tenant) ──────────
  let productId: string | null = null;
  if (barcode) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("warehouse_id", wh)
      .eq("barcode", barcode)
      .maybeSingle();
    if (existing) productId = existing.id;
  }
  if (!productId) {
    const { data: created, error: prodErr } = await supabase
      .from("products")
      .insert({
        warehouse_id: wh,
        barcode,
        enrichment_status: barcode ? "queued" : "manual",
        review_status: "pending",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (prodErr || !created) {
      if (barcode) {
        const { data: retry } = await supabase
          .from("products")
          .select("id")
          .eq("warehouse_id", wh)
          .eq("barcode", barcode)
          .maybeSingle();
        productId = retry?.id ?? null;
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

  const { data: product } = await supabase
    .from("products")
    .select("id, name, category, weight, enrichment_status")
    .eq("id", productId)
    .single();

  // ── decide the zone: operator override → else inferred from the product ─────
  // (At scan time a brand-new product has no category yet → "general"/Ambiente.)
  const inferredZone: Zone = inferZone(product?.category ?? null, false);
  const zone: Zone =
    body.zone && ZONES.includes(body.zone) ? body.zone : inferredZone;

  // ── bins of that ZONE (across stations) + occupancy + same-product bins ─────
  // select("*") keeps this working before AND after migration 0007 adds `level`.
  const [{ data: bins }, { data: occ }, { data: sameBatches }] = await Promise.all([
    supabase
      .from("bins")
      .select("*, stations(name)")
      .eq("warehouse_id", wh)
      .eq("zone", zone)
      .eq("active", true)
      .order("position", { ascending: true }),
    supabase.from("bin_occupancy").select("bin_id, used").eq("warehouse_id", wh),
    supabase
      .from("batches")
      .select("bin_id")
      .eq("warehouse_id", wh)
      .eq("product_id", productId)
      .eq("status", "activo")
      .not("bin_id", "is", null),
  ]);

  const usedMap = new Map((occ ?? []).map((o) => [o.bin_id, o.used]));
  const sameSet = new Set((sameBatches ?? []).map((b) => b.bin_id));

  const binsForStow: BinForStow[] = (bins ?? []).map((b) => {
    const st = b.stations as { name?: string } | null;
    return {
      id: b.id,
      station_id: b.station_id,
      station_name: st?.name ?? "",
      code: b.code,
      position: b.position,
      level: b.level ?? null,
      zone: b.zone as Zone,
      capacity: b.capacity,
      used: usedMap.get(b.id) ?? 0,
      active: b.active,
      hasSameProduct: sameSet.has(b.id),
    };
  });

  const suggestion = suggestBin(
    {
      category: product?.category ?? null,
      weight: product?.weight ?? null,
      expiration_date: null,
      productId,
      forceZone: zone,
    },
    binsForStow,
  );

  return NextResponse.json({
    product_id: productId,
    barcode,
    enrichment_status: (product?.enrichment_status ?? "manual") as EnrichmentStatus,
    product: { name: product?.name ?? null, category: product?.category ?? null },
    zone,
    // What the product's category says (≠ zone when the operator overrides):
    // the client shows a "this looks like Refrigerado" advisory on mismatch.
    inferred_zone: product?.category ? inferredZone : null,
    suggestion,
  });
}
