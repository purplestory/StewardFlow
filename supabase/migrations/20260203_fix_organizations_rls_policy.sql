-- Fix organizations RLS policy to allow authenticated users to insert
-- This should fix the 403 error when creating organizations

-- First, ensure RLS is enabled
alter table public.organizations enable row level security;

-- Drop ALL existing policies on organizations table to start fresh
drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organizations_select_own" on public.organizations;
drop policy if exists "organizations_insert" on public.organizations;
drop policy if exists "organizations_select" on public.organizations;

-- Create insert policy: All authenticated users can create organizations
-- This is needed for the initial organization creation
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

-- Verify the policies were created
-- You can check this in Supabase Dashboard -> Authentication -> Policies
