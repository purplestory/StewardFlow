create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
