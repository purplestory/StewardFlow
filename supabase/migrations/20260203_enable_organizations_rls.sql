-- Enable RLS on organizations table and create policies
-- This fixes the Security Advisor error: "RLS Disabled in Public"

-- Enable RLS
alter table public.organizations enable row level security;

-- Drop existing policies if they exist
drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organizations_select_own" on public.organizations;

-- Create insert policy: All authenticated users can create organizations
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Create select policy: Users can only see organizations they belong to
create policy "organizations_select_own"
on public.organizations
for select
to authenticated
using (
  id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);
