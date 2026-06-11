-- 0009 — stock_movements: auditable history of stock leaving the warehouse.
-- Records WHO (operator snapshot), WHEN (timestamptz), WHAT (product snapshot),
-- HOW MANY, WHY and FROM WHERE (bin code). Snapshots survive product/account
-- deletion, which is what an audit trail requires.

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  barcode text,
  batch_id uuid references public.batches(id) on delete set null,
  bin_code text,
  type text not null default 'retiro' check (type in ('retiro', 'entrada', 'ajuste')),
  quantity int not null check (quantity > 0),
  reason text,
  -- snapshot, NOT an FK: history must survive employee account deletion
  operator_id uuid not null,
  operator_name text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_wh_created_idx
  on public.stock_movements (warehouse_id, created_at desc);

alter table public.stock_movements enable row level security;

-- Members of the warehouse can READ their movement history.
-- Writes happen exclusively through the service-role API (no insert policy).
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select using (warehouse_id = public.auth_warehouse_id());

-- Verification:
--   select * from public.stock_movements order by created_at desc limit 5;
