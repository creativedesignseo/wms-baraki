// Domain types & enums for [PRODUCT_NAME] — multi-tenant WMS.
// These mirror the Postgres CHECK constraints defined in the SQL migrations.

export type Role = "owner" | "manager" | "operator";

export type Zone = "general" | "refrigerado" | "congelado" | "hazmat";
export type Level = "bajo" | "medio" | "alto";
export type WeightClass = "ligero" | "pesado";

export type Condition = "nuevo" | "open_box" | "dañado";
export type Origin = "amazon" | "walmart" | "local" | "otro";
export type BatchStatus = "activo" | "agotado" | "retirado";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type EnrichmentStatus = "queued" | "enriched" | "failed" | "manual";

export interface Warehouse {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  currency_local: string;
  exchange_rate_usd: number;
  owner_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  warehouse_id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface Location {
  id: string;
  warehouse_id: string;
  name: string;
  zone: Zone;
  level: Level;
  weight_class: WeightClass;
  capacity: number;
  active: boolean;
  created_at: string;
}

// Amazon-style chaotic-within-zone storage.
export interface Station {
  id: string;
  warehouse_id: string;
  name: string;
  zone: Zone;
  active: boolean;
  created_at: string;
}

export interface Bin {
  id: string;
  warehouse_id: string;
  station_id: string;
  code: string;
  position: number;
  // Physical shelf height, 1 = suelo. Optional until migration 0007 lands.
  level?: number;
  zone: Zone;
  capacity: number;
  active: boolean;
  created_at: string;
}

export interface BinOccupancy {
  bin_id: string;
  warehouse_id: string;
  station_id: string;
  capacity: number;
  used: number;
  pct: number;
}

export interface Product {
  id: string;
  warehouse_id: string;
  barcode: string | null;
  name: string | null;
  description: string | null;
  category: string | null;
  // weight (kg) and volume (L) are NEVER invented. NULL when unknown.
  weight: number | null;
  volume: number | null;
  image_url: string | null;
  reference_price_usd: number | null;
  suggested_price_usd: number | null;
  approved_price_usd: number | null;
  approved_price_local: number | null;
  review_status: ReviewStatus;
  enrichment_status: EnrichmentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  warehouse_id: string;
  product_id: string;
  location_id: string | null;
  bin_id: string | null;
  quantity: number;
  condition: Condition;
  origin: Origin;
  reception_date: string;
  expiration_date: string | null;
  status: BatchStatus;
  // operator_id is OBLIGATORY — never NULL.
  operator_id: string;
  notes: string | null;
  created_at: string;
}

export interface CurrentStock {
  warehouse_id: string;
  product_id: string;
  total_quantity: number;
}

// ---- API payloads ----

export interface ReceivePayload {
  barcode: string | null;
  quantity: number;
  condition: Condition;
  origin: Origin;
  expiration_date: string | null; // ISO date or null
  notes?: string | null;
  // Optional pre-identified fields (e.g. from /api/vision when no barcode).
  name?: string | null;
  category?: string | null;
}

export interface ReceiveResult {
  product_id: string;
  batch_id: string;
  barcode: string | null;
  enrichment_status: EnrichmentStatus;
  reused_product: boolean;
}

// Result of an external UPC lookup (normalized, provider-agnostic).
export interface UpcLookupResult {
  found: boolean;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  image_url?: string | null;
  // weight in kg if the provider reports it; otherwise undefined (never guessed).
  weight?: number | null;
  reference_price_usd?: number | null;
}

// AIProvider contract outputs.
export interface EnrichedProduct {
  name: string | null;
  category: string | null;
  description: string | null;
  // weight stays null unless a trustworthy source provided it.
  weight: number | null;
  suggested_price_usd: number | null;
}

export interface IdentifiedProduct {
  name: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
}

// Raw data passed to enrichText (whatever the UPC lookup returned).
export type RawLookupData = UpcLookupResult | null;
