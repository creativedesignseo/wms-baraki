-- ============================================================================
-- [PRODUCT_NAME] WMS — 0004 stations + bins (chaotic-within-zone storage)
-- Amazon-style stow: items go into numbered bins; the system suggests a bin in
-- the right temperature zone. A "station" groups the bins shown as the strip.
-- RLS is added in 0005_bins_rls.sql.
-- ============================================================================

-- ── stations (a physical workstation / shelving unit) ───────────────────────
create table if not exists public.stations (
  id           uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  name         text not null,
  zone         text not null
                 check (zone in ('general', 'refrigerado', 'congelado', 'hazmat')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (warehouse_id, name)
);
create index if not exists stations_warehouse_idx on public.stations (warehouse_id);

-- ── bins (numbered slots within a station) ──────────────────────────────────
create table if not exists public.bins (
  id           uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  station_id   uuid not null references public.stations (id) on delete cascade,
  code         text not null,
  position     int not null default 1,            -- 1..N order in the strip
  -- zone denormalized from the station for fast eligibility filtering
  zone         text not null
                 check (zone in ('general', 'refrigerado', 'congelado', 'hazmat')),
  capacity     int not null default 30 check (capacity > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (warehouse_id, code)
);
create index if not exists bins_warehouse_idx on public.bins (warehouse_id);
create index if not exists bins_station_idx on public.bins (station_id, position);

-- ── batches.bin_id (where the stow placed this batch) ───────────────────────
alter table public.batches
  add column if not exists bin_id uuid references public.bins (id) on delete set null;
create index if not exists batches_bin_idx on public.batches (bin_id);

-- ── bin_occupancy view (used units vs capacity) ─────────────────────────────
-- security_invoker → respects bins/batches RLS for the querying user.
create or replace view public.bin_occupancy
  with (security_invoker = true) as
select
  b.id                                                       as bin_id,
  b.warehouse_id,
  b.station_id,
  b.capacity,
  coalesce(sum(ba.quantity) filter (where ba.status = 'activo'), 0)::int as used,
  round(
    100.0 * coalesce(sum(ba.quantity) filter (where ba.status = 'activo'), 0)
    / nullif(b.capacity, 0)
  )::int                                                     as pct
from public.bins b
left join public.batches ba on ba.bin_id = b.id
group by b.id, b.warehouse_id, b.station_id, b.capacity;
