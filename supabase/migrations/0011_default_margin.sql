-- 0011 — default sale margin: the % applied to the suggested (reference) price
-- to PROPOSE a sale price in the stow screen. The operator always sees it and can
-- override (they're the judge). Tolerant: code falls back to 30 before this runs.

alter table public.warehouses
  add column if not exists default_margin_pct numeric not null default 30
  check (default_margin_pct >= 0);

comment on column public.warehouses.default_margin_pct is
  'Margen por defecto en %. Precio de venta sugerido = precio de referencia x (1 + pct/100). El operario puede ajustarlo.';
