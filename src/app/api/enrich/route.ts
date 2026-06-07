// POST /api/enrich — background enrichment. Fired fire-and-forget by the client
// AFTER /api/receive already returned. Never on the critical path.
//
// 1. reuse if the product is already enriched
// 2. UPC lookup (lib/upc.ts — same code path as the /api/lookup proxy)
// 3. Gemini text → normalize name/category to Spanish (never invents weight)
// 4. putaway rules → suggest a location for the batch
// 5. write results with the service-role client (operators can't UPDATE products)
//    review_status stays 'pending' until a manager approves.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth";
import { lookupUpc } from "@/lib/upc";
import { getAIProvider } from "@/lib/ai";
import { suggestLocation } from "@/lib/rules/putaway";
import type { EnrichedProduct, RawLookupData } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

interface EnrichBody {
  product_id: string;
  batch_id?: string | null;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: EnrichBody;
  try {
    body = (await request.json()) as EnrichBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.product_id) {
    return NextResponse.json({ error: "Falta product_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const warehouseId = ctx.profile.warehouse_id;

  // Verify the product belongs to the caller's tenant (RLS-scoped read).
  const { data: product } = await supabase
    .from("products")
    .select("id, barcode, enrichment_status")
    .eq("id", body.product_id)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  // Already enriched or manually identified → nothing to do.
  if (product.enrichment_status !== "queued") {
    return NextResponse.json(
      { skipped: true, enrichment_status: product.enrichment_status },
      { status: 200 },
    );
  }

  const admin = createAdminClient();

  // ── 1+2+3: UPC lookup + Gemini ──────────────────────────────────────────────
  let rawData: RawLookupData = null;
  if (product.barcode) {
    rawData = await lookupUpc(product.barcode);
  }

  let enriched: EnrichedProduct | null = null;
  let status: "enriched" | "failed" = "failed";
  try {
    enriched = await getAIProvider().enrichText(product.barcode, rawData);
    status = "enriched";
  } catch {
    // Gemini failed — fall back to whatever UPC gave us.
    if (rawData?.found) {
      enriched = {
        name: rawData.name ?? null,
        category: rawData.category ?? null,
        description: rawData.description ?? null,
        weight: rawData.weight ?? null,
        suggested_price_usd: rawData.reference_price_usd ?? null,
      };
      status = "enriched";
    } else {
      status = "failed";
    }
  }

  // ── 4: putaway suggestion ───────────────────────────────────────────────────
  let suggestedLocationId: string | null = null;
  if (body.batch_id) {
    const { data: locations } = await supabase
      .from("locations")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .eq("active", true);

    const { data: batch } = await supabase
      .from("batches")
      .select("id, location_id, expiration_date")
      .eq("id", body.batch_id)
      .eq("warehouse_id", warehouseId)
      .maybeSingle();

    if (locations && batch && !batch.location_id) {
      const suggestion = suggestLocation(
        {
          category: enriched?.category ?? null,
          weight: enriched?.weight ?? null,
          expiration_date: batch.expiration_date,
        },
        locations,
      );
      suggestedLocationId = suggestion.location?.id ?? null;
    }
  }

  // ── 5: persist (service role; scoped to id + warehouse_id) ──────────────────
  const update: ProductUpdate = {
    enrichment_status: status,
  };
  if (enriched) {
    if (enriched.name) update.name = enriched.name;
    if (enriched.category) update.category = enriched.category;
    if (enriched.description) update.description = enriched.description;
    // weight only when a trustworthy source provided it — never invented.
    if (enriched.weight !== null) update.weight = enriched.weight;
    if (enriched.suggested_price_usd !== null)
      update.suggested_price_usd = enriched.suggested_price_usd;
    if (rawData?.image_url) update.image_url = rawData.image_url;
    if (rawData?.reference_price_usd != null)
      update.reference_price_usd = rawData.reference_price_usd;
  }

  const { error: updErr } = await admin
    .from("products")
    .update(update)
    .eq("id", product.id)
    .eq("warehouse_id", warehouseId);

  if (suggestedLocationId && body.batch_id) {
    await admin
      .from("batches")
      .update({ location_id: suggestedLocationId })
      .eq("id", body.batch_id)
      .eq("warehouse_id", warehouseId)
      .is("location_id", null);
  }

  if (updErr) {
    return NextResponse.json(
      { error: "No se pudo enriquecer", detail: updErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      enrichment_status: status,
      suggested_location_id: suggestedLocationId,
    },
    { status: 200 },
  );
}
