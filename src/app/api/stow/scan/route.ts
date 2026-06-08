// POST /api/stow/scan — Amazon-style stow step 1 (read/suggest, no batch yet).
// Resolves/creates the minimal product for the barcode and suggests a bin within
// the operator's station (chaotic-within-zone). The CLIENT fires /api/enrich
// fire-and-forget after this returns; the batch is created later by /api/stow/confirm.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { suggestBin, type BinForStow } from "@/lib/rules/putaway";
import type { Zone, EnrichmentStatus } from "@/lib/types";

interface ScanBody {
  barcode: string | null;
  station_id: string;
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
  if (!body.station_id) {
    return NextResponse.json({ error: "Falta station_id" }, { status: 400 });
  }
  const barcode = body.barcode?.trim() || null;

  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  // ── station (validate + get its zone) ───────────────────────────────────────
  const { data: station } = await supabase
    .from("stations")
    .select("id, name, zone")
    .eq("id", body.station_id)
    .eq("warehouse_id", wh)
    .maybeSingle();
  if (!station) {
    return NextResponse.json({ error: "Estación no encontrada" }, { status: 404 });
  }

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
      // race on the partial unique (barcode) index → re-select
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

  // ── bins of this station + occupancy + which already hold this product ──────
  const [{ data: bins }, { data: occ }, { data: sameBatches }] = await Promise.all([
    supabase
      .from("bins")
      .select("id, station_id, code, position, zone, capacity, active")
      .eq("warehouse_id", wh)
      .eq("station_id", station.id)
      .eq("active", true),
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

  const binsForStow: BinForStow[] = (bins ?? []).map((b) => ({
    id: b.id,
    station_id: b.station_id,
    station_name: station.name,
    code: b.code,
    position: b.position,
    zone: b.zone as Zone,
    capacity: b.capacity,
    used: usedMap.get(b.id) ?? 0,
    active: b.active,
    hasSameProduct: sameSet.has(b.id),
  }));

  const suggestion = suggestBin(
    {
      category: product?.category ?? null,
      weight: product?.weight ?? null,
      expiration_date: null,
      productId,
      forceZone: station.zone as Zone,
    },
    binsForStow,
  );

  return NextResponse.json({
    product_id: productId,
    barcode,
    enrichment_status: (product?.enrichment_status ?? "manual") as EnrichmentStatus,
    product: { name: product?.name ?? null, category: product?.category ?? null },
    station: { id: station.id, name: station.name, zone: station.zone },
    suggestion,
  });
}
