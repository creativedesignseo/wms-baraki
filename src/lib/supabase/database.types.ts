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
