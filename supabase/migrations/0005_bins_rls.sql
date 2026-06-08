-- ============================================================================
-- [PRODUCT_NAME] WMS — 0005 RLS for stations + bins, and bin_id on batches
-- Same pattern as 0002: scope by auth_warehouse_id(); no USING(true).
-- ============================================================================

alter table public.stations enable row level security;
alter table public.bins     enable row level security;

-- ── stations ────────────────────────────────────────────────────────────────
drop policy if exists stations_select on public.stations;
create policy stations_select on public.stations
  for select to authenticated
  using (warehouse_id = public.auth_warehouse_id());

drop policy if exists stations_write_mgr on public.stations;
create policy stations_write_mgr on public.stations
  for all to authenticated
  using (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  )
  with check (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  );

-- ── bins ─────────────────────────────────────────────────────────────────────
drop policy if exists bins_select on public.bins;
create policy bins_select on public.bins
  for select to authenticated
  using (warehouse_id = public.auth_warehouse_id());

drop policy if exists bins_write_mgr on public.bins;
create policy bins_write_mgr on public.bins
  for all to authenticated
  using (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  )
  with check (
    warehouse_id = public.auth_warehouse_id()
    and public.auth_role() in ('manager', 'owner')
  );

-- ── batches INSERT: also validate bin_id belongs to the tenant ──────────────
-- Operators set bin_id at INSERT time (stow confirm), so no operator UPDATE is needed.
drop policy if exists batches_insert on public.batches;
create policy batches_insert on public.batches
  for insert to authenticated
  with check (
    warehouse_id = public.auth_warehouse_id()
    and operator_id = auth.uid()
    and (
      bin_id is null
      or bin_id in (select id from public.bins where warehouse_id = public.auth_warehouse_id())
    )
  );
