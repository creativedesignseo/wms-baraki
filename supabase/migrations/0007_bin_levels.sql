-- 0007 — bins.level: physical shelf height (LaceUp/Amazon model).
-- COLOR = LEVEL on the wall UI: 1 = suelo (amarillo), 2 = medio (morado),
-- 3 = alto (azul), 4 (verde), 5 (rojo). Additive and backward-compatible:
-- old code ignores the column; new code falls back gracefully if it's absent.

alter table public.bins
  add column if not exists level int not null default 1
  check (level between 1 and 5);

-- Demo seed backfill (Bodegón Baraki Valencia):
--   AMB-01..18 → 3 niveles × 6 bins  (estantería ambiente de 3 alturas)
--   REF-01..06 → 2 niveles × 3 bins  (nevera con 2 baldas)
--   CON-01..04 → nivel 1            (arcones congeladores, a ras de suelo)
update public.bins set level = ((position - 1) / 6) + 1 where code like 'AMB-%';
update public.bins set level = ((position - 1) / 3) + 1 where code like 'REF-%';
update public.bins set level = 1 where code like 'CON-%';

-- Verification:
--   select code, position, level from public.bins order by code;
