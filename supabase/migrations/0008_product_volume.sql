-- 0008 — products.volume: storage volume in liters (weight already exists, kg).
-- Both are placement hints: heavy goods go to low shelves; bulky goods will
-- prefer larger bins once bins carry a size. Never invented — only set when a
-- trustworthy source or the operator provides it.

alter table public.products
  add column if not exists volume numeric
  check (volume is null or volume >= 0);

comment on column public.products.volume is 'Volumen en litros (hint de ubicación). NULL si desconocido.';
