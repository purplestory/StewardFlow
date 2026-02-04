-- Add RLS policies for organizations table
-- Allow authenticated users to create organizations
-- Allow users to select organizations they belong to

alter table public.organizations enable row level security;

create policy if not exists "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

create policy if not exists "organizations_select_own"
on public.organizations
for select
to authenticated
using (
  id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);
