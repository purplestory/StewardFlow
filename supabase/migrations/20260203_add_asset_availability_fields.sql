alter table public.assets
  add column if not exists mobility text,
  add column if not exists loanable boolean,
  add column if not exists usable_until date;

update public.assets
  set mobility = 'movable'
where mobility is null;

update public.assets
  set loanable = true
where loanable is null;
