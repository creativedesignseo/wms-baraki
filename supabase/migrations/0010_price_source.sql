-- 0010 — price provenance: where an approved price came from.
-- Goal (hard guarantee): a product can't carry an approved price without a
-- recorded source — same rule as weight/price, never an unsourced number.
--
-- This migration adds the columns + backfills existing approved rows to
-- 'manual'. The HARD CHECK (approved price requires a source) is left COMMENTED
-- until the app wires price_source on every approve path — enabling it before
-- that would reject legitimate approvals. See HANDOFF "Sistema de PRECIOS".

alter table public.products
  add column if not exists price_source text
  check (price_source is null or price_source in ('offers_median', 'deep_search', 'manual'));

alter table public.products
  add column if not exists price_sources jsonb;

comment on column public.products.price_source is
  'Procedencia del precio: offers_median (mediana de offers UPCitemdb) | deep_search (IA con búsqueda que cita fuente) | manual (gerente). NULL si aún sin precio.';
comment on column public.products.price_sources is
  'Fuentes citadas del precio (array JSON de {merchant,url}). Respalda la regla: nunca un precio sin fuente.';

-- Backfill: any price already approved was set by a manager by hand.
update public.products
  set price_source = 'manual'
  where approved_price_usd is not null
    and price_source is null;

-- HARD GUARANTEE — enable ONLY after the app sets price_source on every approve
-- path (offers_median / deep_search / manual). Until then it would reject valid
-- approvals, so it stays commented:
-- alter table public.products
--   add constraint products_price_needs_source
--   check (approved_price_usd is null or price_source is not null);
