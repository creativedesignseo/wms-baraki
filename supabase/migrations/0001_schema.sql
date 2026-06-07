-- ============================================================================
-- [PRODUCT_NAME] WMS — 0001 schema
-- Tables, CHECK constraints, indexes, current_stock view, updated_at trigger.
-- Multi-tenant by warehouse_id column. RLS is enabled in 0002_rls.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── warehouses ──────────────────────────────────────────────────────────────
create table if not exists public.warehouses (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  country           text,
  currency_local    text not null default 'USD',
  exchange_rate_usd numeric not null default 1 check (exchange_rate_usd > 0),
  owner_id          uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ── profiles (one per auth user; defines tenant membership + role) ───────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  full_name    text,
  role         text not null default 'operator'
                 check (role in ('owner', 'manager', 'operator')),
  created_at   timestamptz not null default now()
);
create index if not exists profiles_warehouse_idx on public.profiles (warehouse_id);

-- ── locations ───────────────────────────────────────────────────────────────
create table if not exists public.locations (
  id           uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  name         text not null,
  zone         text not null
                 check (zone in ('general', 'refrigerado', 'congelado', 'hazmat')),
  level        text not null default 'medio'
                 check (level in ('bajo', 'medio', 'alto')),
  weight_class text not null default 'ligero'
                 check (weight_class in ('ligero', 'pesado')),
  capacity     int not null default 100 check (capacity > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  -- name unique per warehouse
  unique (warehouse_id, name)
);
create index if not exists locations_warehouse_idx on public.locations (warehouse_id);

-- ── products ────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  warehouse_id         uuid not null references public.warehouses (id) on delete cascade,
  barcode              text,
  name                 text,
  description          text,
  category             text,
  -- weight is NEVER invented. NULL when unknown.
  weight               numeric check (weight is null or weight >= 0),
  image_url            text,
  reference_price_usd  numeric check (reference_price_usd is null or reference_price_usd >= 0),
  suggested_price_usd  numeric check (suggested_price_usd is null or suggested_price_usd >= 0),
  approved_price_usd   numeric check (approved_price_usd is null or approved_price_usd >= 0),
  approved_price_local numeric check (approved_price_local is null or approved_price_local >= 0),
  review_status        text not null default 'pending'
                         check (review_status in ('pending', 'approved', 'rejected')),
  enrichment_status    text not null default 'queued'
                         check (enrichment_status in ('queued', 'enriched', 'failed', 'manual')),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists products_warehouse_idx on public.products (warehouse_id);
create index if not exists products_review_idx on public.products (warehouse_id, review_status);
-- barcode UNIQUE per warehouse, only when barcode is present (partial index)
create unique index if not exists products_barcode_unique
  on public.products (warehouse_id, barcode)
  where barcode is not null;

-- ── batches ─────────────────────────────────────────────────────────────────
create table if not exists public.batches (
  id              uuid primary key default gen_random_uuid(),
  warehouse_id    uuid not null references public.warehouses (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  location_id     uuid references public.locations (id) on delete set null,
  quantity        int not null check (quantity > 0),
  condition       text not null default 'nuevo'
                    check (condition in ('nuevo', 'open_box', 'dañado')),
  origin          text not null default 'otro'
                    check (origin in ('amazon', 'walmart', 'local', 'otro')),
  reception_date  timestamptz not null default now(),
  expiration_date date,
  status          text not null default 'activo'
                    check (status in ('activo', 'agotado', 'retirado')),
  -- operator_id is OBLIGATORY — never NULL.
  operator_id     uuid not null references auth.users (id) on delete restrict,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists batches_warehouse_idx on public.batches (warehouse_id);
create index if not exists batches_product_idx on public.batches (product_id);
create index if not exists batches_expiration_idx on public.batches (warehouse_id, expiration_date);
create index if not exists batches_status_idx on public.batches (warehouse_id, status);

-- ── current_stock view (security_invoker → respects batches RLS) ─────────────
create or replace view public.current_stock
  with (security_invoker = true) as
select
  warehouse_id,
  product_id,
  sum(quantity)::bigint as total_quantity
from public.batches
where status = 'activo'
group by warehouse_id, product_id;

-- ── updated_at trigger for products ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
