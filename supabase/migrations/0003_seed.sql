-- ============================================================================
-- [PRODUCT_NAME] WMS — 0003 seed + new-user trigger
-- Demo warehouse (fixed UUID), demo locations, and an auto-profile trigger so
-- every new auth user gets a profile. New users default to the demo warehouse
-- as 'operator' unless their auth metadata overrides warehouse_id/role.
-- ============================================================================

-- ── demo warehouse (fixed id so the trigger can reference it) ────────────────
insert into public.warehouses (id, name, slug, country, currency_local, exchange_rate_usd)
values (
  '00000000-0000-0000-0000-000000000001',
  'Bodegón Demo',
  'demo',
  'VE',
  'VES',
  40        -- placeholder rate; the owner sets the real one in /settings
)
on conflict (id) do nothing;

-- ── demo locations across zones / levels / weight classes ───────────────────
insert into public.locations (warehouse_id, name, zone, level, weight_class, capacity)
values
  ('00000000-0000-0000-0000-000000000001', 'A1 — General bajo',    'general',     'bajo',  'pesado',  150),
  ('00000000-0000-0000-0000-000000000001', 'A2 — General medio',   'general',     'medio', 'ligero',  200),
  ('00000000-0000-0000-0000-000000000001', 'A3 — General alto',    'general',     'alto',  'ligero',  200),
  ('00000000-0000-0000-0000-000000000001', 'R1 — Refrigerado bajo','refrigerado', 'bajo',  'pesado',  100),
  ('00000000-0000-0000-0000-000000000001', 'R2 — Refrigerado medio','refrigerado','medio', 'ligero',  120),
  ('00000000-0000-0000-0000-000000000001', 'C1 — Congelado bajo',  'congelado',   'bajo',  'pesado',  80),
  ('00000000-0000-0000-0000-000000000001', 'C2 — Congelado medio', 'congelado',   'medio', 'ligero',  100),
  ('00000000-0000-0000-0000-000000000001', 'H1 — Hazmat bajo',     'hazmat',      'bajo',  'pesado',  40)
on conflict (warehouse_id, name) do nothing;

-- ── auto-create a profile for every new auth user ───────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_warehouse uuid;
  v_role text;
begin
  v_warehouse := coalesce(
    nullif(new.raw_user_meta_data->>'warehouse_id', '')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'operator');
  if v_role not in ('owner', 'manager', 'operator') then
    v_role := 'operator';
  end if;

  insert into public.profiles (id, warehouse_id, full_name, role)
  values (new.id, v_warehouse, new.raw_user_meta_data->>'full_name', v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
