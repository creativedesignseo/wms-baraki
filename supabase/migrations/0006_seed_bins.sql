-- ============================================================================
-- [PRODUCT_NAME] WMS — 0006 seed demo stations + bins
-- Demo warehouse 00000000-0000-0000-0000-000000000001:
--   · "Recepción Ambiente" (general)     → 18 bins (AMB-01..AMB-18)
--   · "Cámara Refrigerada" (refrigerado)  → 6 bins  (REF-01..REF-06)
--   · "Congelador" (congelado)            → 4 bins  (CON-01..CON-04)
-- Fixed station UUIDs so the bin inserts can reference them. Idempotent.
-- ============================================================================

insert into public.stations (id, warehouse_id, name, zone)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Recepción Ambiente', 'general'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', 'Cámara Refrigerada', 'refrigerado'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'Congelador', 'congelado')
on conflict (id) do nothing;

insert into public.bins (warehouse_id, station_id, code, position, zone, capacity)
select '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-0000000000a1',
       'AMB-' || lpad(g::text, 2, '0'), g, 'general', 30
from generate_series(1, 18) g
on conflict (warehouse_id, code) do nothing;

insert into public.bins (warehouse_id, station_id, code, position, zone, capacity)
select '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-0000000000a2',
       'REF-' || lpad(g::text, 2, '0'), g, 'refrigerado', 20
from generate_series(1, 6) g
on conflict (warehouse_id, code) do nothing;

insert into public.bins (warehouse_id, station_id, code, position, zone, capacity)
select '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-0000000000a3',
       'CON-' || lpad(g::text, 2, '0'), g, 'congelado', 15
from generate_series(1, 4) g
on conflict (warehouse_id, code) do nothing;
