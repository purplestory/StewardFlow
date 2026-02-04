alter table public.assets
  add column if not exists purchase_date date,
  add column if not exists purchase_price integer,
  add column if not exists useful_life_years integer,
  add column if not exists last_used_at timestamp with time zone;
