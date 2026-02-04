create table if not exists public.organization_invites (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  email text not null,
  role text default 'user',
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.organization_invites
  add column if not exists revoked_at timestamp with time zone;
