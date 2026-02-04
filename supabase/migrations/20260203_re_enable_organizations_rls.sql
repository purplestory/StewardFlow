-- Re-enable RLS on organizations table with proper policies
-- Now that we've confirmed organization creation works, we can safely enable RLS

-- Step 1: Enable RLS
alter table public.organizations enable row level security;

-- Step 2: Drop any existing policies
drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organizations_select_own" on public.organizations;

-- Step 3: Create insert policy - ALL authenticated users can create organizations
-- This is needed for the initial organization creation
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Step 4: Create select policy - Users can only see organizations they belong to
-- Using EXISTS for better performance and reliability
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

-- Step 5: Verify policies were created
SELECT 
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';
