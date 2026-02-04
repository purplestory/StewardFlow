create table if not exists public.asset_transfer_requests (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  asset_id uuid references public.assets(id),
  requester_id uuid references public.profiles(id),
  from_department text,
  to_department text,
  status text default 'pending',
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone
);
