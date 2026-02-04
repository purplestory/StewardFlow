-- Check and fix organizations RLS policies
-- First, let's see what policies currently exist

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- If the above query shows no policies or incorrect policies, run the following:

-- Step 1: Disable RLS
alter table public.organizations disable row level security;

-- Step 2: Drop all policies
drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organizations_select_own" on public.organizations;

-- Step 3: Re-enable RLS
alter table public.organizations enable row level security;

-- Step 4: Create insert policy with the simplest possible condition
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Step 5: Create select policy
create policy "organizations_select_own"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1 
    from public.profiles 
    where id = auth.uid() 
      and organization_id = organizations.id
  )
);

-- Verify the policies
SELECT 
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';
