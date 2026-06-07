-- ============================================================================
-- [PRODUCT_NAME] WMS — 0002 RLS
-- Helper functions + Row Level Security. NO policy uses USING(true).
-- Every policy scopes to the authenticated user's warehouse_id.
-- ============================================================================

-- ── helper: warehouse_id of the current user ────────────────────────────────
-- SECURITY DEFINER so it can read profiles without recursing into profiles RLS.
create or replace function public.auth_warehouse_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select warehouse_id from public.profiles where id = auth.uid();
$$;

-- ── helper: role of the current user ─────────────────────────────────────────
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.auth_warehouse_id() from public;
revoke all on function public.auth_role() from public;
grant execute on function public.auth_warehouse_id() to authenticated;
grant execute on function public.auth_role() to authenticated;

-- ── enable RLS everywhere ───────────────────────────────────────────────────
alter table public.warehouses enable row level security;
alter table public.profiles   enable row level security;
alter table public.locations  enable row level security;
alter table public.products   enable row level security;
alter table public.batches    enable row level security;

-- ── warehouses ──────────────────────────────────────────────────────────────
drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses
  for select to authenticated
  using (id = public.auth_warehouse_id());

drop policy if exists warehouses_update_owner on public.warehouses;
create policy warehouses_update_owner on public.warehouses
  for update to authenticated
  using (id = public.auth_warehouse_id() and public.auth_role() = 'owner')
  with check (id = public.auth_warehouse_id() and public.auth_role() = 'owner');

-- ── profiles ────────────────────────────────────────────────────────────────
-- Read profiles of your own warehouse (needed for audit operator names).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (warehouse_id = public.auth_warehouse_id());

-- Owner may update roles of profiles in their warehouse.
drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (warehouse_id = public.auth_warehouse_id() and public.auth_role() = 'owner')
  with check (warehouse_id = public.auth_warehouse_id() and public.auth_role() = 'owner');
-- (INSERT happens via the handle_new_user trigger, which is SECURITY DEFINER.)

-- ── locations ───────────────────────────────────────────────────────────────
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations
  for select to authenticated
  using (warehouse_id = public.auth_warehouse_id());

drop policy if exists locations_write_mgr on public.locations;
create policy locations_write_mgr on public.locations
  for all to authenticated
  using (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  )
  with check (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  );

-- ── products ────────────────────────────────────────────────────────────────
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (warehouse_id = public.auth_warehouse_id());

-- Any tenant role can create a product (blind receiving).
drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated
  with check (warehouse_id = public.auth_warehouse_id());

-- Only manager/owner can UPDATE products (covers review_status & approved_price_*).
-- Background enrichment updates go through the service-role client (bypasses RLS).
drop policy if exists products_update_mgr on public.products;
create policy products_update_mgr on public.products
  for update to authenticated
  using (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  )
  with check (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  );

-- ── batches ─────────────────────────────────────────────────────────────────
drop policy if exists batches_select on public.batches;
create policy batches_select on public.batches
  for select to authenticated
  using (warehouse_id = public.auth_warehouse_id());

-- Any tenant role can insert a batch, but operator_id must be the actual user.
drop policy if exists batches_insert on public.batches;
create policy batches_insert on public.batches
  for insert to authenticated
  with check (
    warehouse_id = public.auth_warehouse_id()
    and operator_id = auth.uid()
  );

-- Manager/owner can update batches (status changes, location moves).
drop policy if exists batches_update_mgr on public.batches;
create policy batches_update_mgr on public.batches
  for update to authenticated
  using (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  )
  with check (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  );
