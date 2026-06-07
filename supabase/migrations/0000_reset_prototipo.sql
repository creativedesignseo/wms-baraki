-- ============================================================================
-- [PRODUCT_NAME] WMS — 0000 RESET (one-time)
-- This Supabase project contained an earlier single-tenant prototype with an
-- incompatible schema (no warehouse_id, no RLS, different columns).
-- A local backup was taken first: supabase/_backup_prototipo_2026-06-08/*.json
-- This drops the prototype objects so the multi-tenant schema installs clean.
-- Run this ONCE, before 0001/0002/0003. Safe to re-run (idempotent).
-- ============================================================================

drop view if exists public.current_stock cascade;

drop table if exists public.batches cascade;
drop table if exists public.inventory_movements cascade;
drop table if exists public.products_catalog cascade;
drop table if exists public.products cascade;
drop table if exists public.locations cascade;

-- Drop the prototype's RPC regardless of its argument signature.
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where proname = 'rls_auto_enable'
      and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end $$;
