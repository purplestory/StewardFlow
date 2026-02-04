-- Verify and fix organizations RLS policies
-- Check if policies exist and have correct conditions

-- First, let's see what policies exist
-- Run this to check: SELECT * FROM pg_policies WHERE tablename = 'organizations';

-- Drop and recreate to ensure they're correct
drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organizations_select_own" on public.organizations;

-- Create insert policy with explicit WITH CHECK (true)
-- This allows ANY authenticated user to insert organizations
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Create select policy
-- Users can only see organizations they belong to
create policy "organizations_select_own"
on public.organizations
for select
to authenticated
using (
  id in (
    select organization_id 
    from public.profiles 
    where id = auth.uid()
  )
);

-- Verify RLS is enabled
alter table public.organizations enable row level security;
