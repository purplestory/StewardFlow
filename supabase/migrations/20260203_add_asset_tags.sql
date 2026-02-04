alter table public.assets
  add column if not exists tags text[];

update public.assets
  set tags = '{}'::text[]
where tags is null;
