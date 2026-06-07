// /inventory — grouped by product, expandable by batch, server-side paginated.
// Filters: category + search drive pagination/count (product-level, DB).
// status + zone + expiry refine the batches shown (zone/expiry hide products
// with no matching batch on the current page).
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fefoLevel, type FefoLevel } from "@/lib/fefo";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { InventoryTable, type InventoryRow } from "@/components/inventory/InventoryTable";
import type { Zone, BatchStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const WORST_ORDER: Record<FefoLevel, number> = { rojo: 0, amarillo: 1, verde: 2, none: 3 };

interface SearchParams {
  page?: string;
  category?: string;
  zone?: string;
  status?: string;
  expiry?: string;
  q?: string;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const supabase = await createClient();
  const warehouseId = ctx.profile.warehouse_id;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const statusFilter = (sp.status as BatchStatus) || "activo";
  const zoneFilter = (sp.zone as Zone) || "";
  const expiryFilter = sp.expiry || ""; // verde | amarillo | rojo | sin

  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("currency_local")
    .eq("id", warehouseId)
    .maybeSingle();
  const currency = warehouse?.currency_local ?? "USD";

  // distinct categories for the filter dropdown
  const { data: catRows } = await supabase
    .from("products")
    .select("category")
    .eq("warehouse_id", warehouseId)
    .not("category", "is", null)
    .limit(1000);
  const categories = Array.from(
    new Set((catRows ?? []).map((r) => r.category).filter(Boolean)),
  ).sort() as string[];

  // ── product page (category + search drive pagination/count) ─────────────────
  let productQuery = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("warehouse_id", warehouseId);
  if (sp.category) productQuery = productQuery.eq("category", sp.category);
  if (sp.q) productQuery = productQuery.or(`name.ilike.%${sp.q}%,barcode.ilike.%${sp.q}%`);
  productQuery = productQuery.order("created_at", { ascending: false }).range(from, to);

  const { data: products, count } = await productQuery;
  const productIds = (products ?? []).map((p) => p.id);

  // ── batches for these products (status + zone filters at DB) ────────────────
  const rowsById = new Map<string, InventoryRow>();
  for (const p of products ?? []) {
    rowsById.set(p.id, {
      product: {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        category: p.category,
        image_url: p.image_url,
        approved_price_usd: p.approved_price_usd,
        approved_price_local: p.approved_price_local,
        review_status: p.review_status,
      },
      totalQty: 0,
      worstFefo: "none",
      batches: [],
    });
  }

  if (productIds.length > 0) {
    const locEmbed = zoneFilter ? "locations!inner(name, zone)" : "locations(name, zone)";
    let batchQuery = supabase
      .from("batches")
      .select(`*, ${locEmbed}`)
      .eq("warehouse_id", warehouseId)
      .in("product_id", productIds)
      .eq("status", statusFilter)
      .order("expiration_date", { ascending: true, nullsFirst: false });
    if (zoneFilter) batchQuery = batchQuery.eq("locations.zone", zoneFilter);

    const { data: batches } = await batchQuery;

    // operator names
    const operatorIds = Array.from(
      new Set((batches ?? []).map((b) => b.operator_id)),
    );
    const operatorNames = new Map<string, string>();
    if (operatorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", operatorIds);
      for (const pr of profs ?? [])
        operatorNames.set(pr.id, pr.full_name ?? "—");
    }

    for (const b of batches ?? []) {
      // expiry bucket filter (JS)
      const level = fefoLevel(b.expiration_date);
      if (expiryFilter) {
        if (expiryFilter === "sin" && level !== "none") continue;
        if (expiryFilter !== "sin" && level !== expiryFilter) continue;
      }
      const row = rowsById.get(b.product_id);
      if (!row) continue;
      const loc = b.locations as { name?: string; zone?: string } | null;
      row.batches.push({
        id: b.id,
        quantity: b.quantity,
        condition: b.condition,
        origin: b.origin,
        expiration_date: b.expiration_date,
        reception_date: b.reception_date,
        status: b.status,
        locationName: loc?.name ?? null,
        zone: (loc?.zone as Zone) ?? null,
        operatorName: operatorNames.get(b.operator_id) ?? "—",
      });
      row.totalQty += b.quantity;
      if (WORST_ORDER[level] < WORST_ORDER[row.worstFefo]) row.worstFefo = level;
    }
  }

  // hide products with no matching batch when a batch-level filter is active
  const filtering = Boolean(zoneFilter || expiryFilter);
  const rows = Array.from(rowsById.values()).filter(
    (r) => !filtering || r.batches.length > 0,
  );

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Inventario</h1>
      <InventoryFilters
        categories={categories}
        current={{
          category: sp.category ?? "",
          zone: zoneFilter,
          status: statusFilter,
          expiry: expiryFilter,
          q: sp.q ?? "",
        }}
      />
      <InventoryTable
        rows={rows}
        currency={currency}
        page={page}
        totalPages={totalPages}
        total={total}
        filtering={filtering}
      />
    </div>
  );
}
