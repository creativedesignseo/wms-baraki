// Hand-written Database type for the typed Supabase client.
// Mirrors the SQL migrations in supabase/migrations/.
// Keep in sync with src/lib/types.ts.
//
// Standalone Row/Insert/Update aliases (no self-referencing the Database type)
// and a full GenericSchema shape (Tables/Views/Functions/Enums/CompositeTypes +
// Relationships) so supabase-js applies the types instead of falling back to never.

import type {
  Role,
  Zone,
  Level,
  WeightClass,
  Condition,
  Origin,
  BatchStatus,
  ReviewStatus,
  EnrichmentStatus,
} from "@/lib/types";

type WarehouseRow = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  currency_local: string;
  exchange_rate_usd: number;
  // Optional until migration 0011 lands (code falls back to 30).
  default_margin_pct?: number;
  owner_id: string | null;
  created_at: string;
};
type WarehouseInsert = {
  id?: string;
  name: string;
  slug: string;
  country?: string | null;
  currency_local?: string;
  exchange_rate_usd?: number;
  default_margin_pct?: number;
  owner_id?: string | null;
  created_at?: string;
};

type ProfileRow = {
  id: string;
  warehouse_id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};
type ProfileInsert = {
  id: string;
  warehouse_id: string;
  full_name?: string | null;
  role?: Role;
  created_at?: string;
};

type LocationRow = {
  id: string;
  warehouse_id: string;
  name: string;
  zone: Zone;
  level: Level;
  weight_class: WeightClass;
  capacity: number;
  active: boolean;
  created_at: string;
};
type LocationInsert = {
  id?: string;
  warehouse_id: string;
  name: string;
  zone: Zone;
  level: Level;
  weight_class: WeightClass;
  capacity?: number;
  active?: boolean;
  created_at?: string;
};

type ProductRow = {
  id: string;
  warehouse_id: string;
  barcode: string | null;
  name: string | null;
  description: string | null;
  category: string | null;
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
};
type ProductInsert = {
  id?: string;
  warehouse_id: string;
  barcode?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  weight?: number | null;
  volume?: number | null;
  image_url?: string | null;
  reference_price_usd?: number | null;
  suggested_price_usd?: number | null;
  approved_price_usd?: number | null;
  approved_price_local?: number | null;
  review_status?: ReviewStatus;
  enrichment_status?: EnrichmentStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BatchRow = {
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
  operator_id: string;
  notes: string | null;
  created_at: string;
};
type BatchInsert = {
  id?: string;
  warehouse_id: string;
  product_id: string;
  location_id?: string | null;
  bin_id?: string | null;
  quantity: number;
  condition: Condition;
  origin?: Origin;
  reception_date?: string;
  expiration_date?: string | null;
  status?: BatchStatus;
  operator_id: string;
  notes?: string | null;
  created_at?: string;
};

type StationRow = {
  id: string;
  warehouse_id: string;
  name: string;
  zone: Zone;
  active: boolean;
  created_at: string;
};
type StationInsert = {
  id?: string;
  warehouse_id: string;
  name: string;
  zone: Zone;
  active?: boolean;
  created_at?: string;
};

type BinRow = {
  id: string;
  warehouse_id: string;
  station_id: string;
  code: string;
  position: number;
  zone: Zone;
  // Optional until migration 0007 adds the column (1=suelo … 5).
  level?: number;
  capacity: number;
  active: boolean;
  created_at: string;
};
type BinInsert = {
  id?: string;
  warehouse_id: string;
  station_id: string;
  code: string;
  position?: number;
  level?: number;
  zone: Zone;
  capacity?: number;
  active?: boolean;
  created_at?: string;
};

// Audit trail for outbound stock (table added by migration 0009 — code that
// touches it must tolerate its absence pre-migration).
type StockMovementRow = {
  id: string;
  warehouse_id: string;
  product_id: string | null;
  product_name: string | null;
  barcode: string | null;
  batch_id: string | null;
  bin_code: string | null;
  type: string;
  quantity: number;
  reason: string | null;
  operator_id: string;
  operator_name: string | null;
  created_at: string;
};
type StockMovementInsert = {
  id?: string;
  warehouse_id: string;
  product_id?: string | null;
  product_name?: string | null;
  barcode?: string | null;
  batch_id?: string | null;
  bin_code?: string | null;
  type?: string;
  quantity: number;
  reason?: string | null;
  operator_id: string;
  operator_name?: string | null;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      warehouses: {
        Row: WarehouseRow;
        Insert: WarehouseInsert;
        Update: Partial<WarehouseInsert>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      locations: {
        Row: LocationRow;
        Insert: LocationInsert;
        Update: Partial<LocationInsert>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: Partial<ProductInsert>;
        Relationships: [];
      };
      batches: {
        Row: BatchRow;
        Insert: BatchInsert;
        Update: Partial<BatchInsert>;
        Relationships: [];
      };
      stations: {
        Row: StationRow;
        Insert: StationInsert;
        Update: Partial<StationInsert>;
        Relationships: [];
      };
      bins: {
        Row: BinRow;
        Insert: BinInsert;
        Update: Partial<BinInsert>;
        Relationships: [];
      };
      stock_movements: {
        Row: StockMovementRow;
        Insert: StockMovementInsert;
        Update: Partial<StockMovementInsert>;
        Relationships: [];
      };
    };
    Views: {
      current_stock: {
        Row: {
          warehouse_id: string;
          product_id: string;
          total_quantity: number;
        };
        Relationships: [];
      };
      bin_occupancy: {
        Row: {
          bin_id: string;
          warehouse_id: string;
          station_id: string;
          capacity: number;
          used: number;
          pct: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      auth_warehouse_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      auth_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
