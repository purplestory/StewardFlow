-- Debug and fix organizations RLS policies
-- This will check current state and recreate policies if needed

-- Step 1: Check current RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- Step 2: Check existing policies
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- Step 3: Disable RLS completely
alter table public.organizations disable row level security;

-- Step 4: Drop ALL policies using a more aggressive approach
do $$
declare
    policy_record record;
begin
    -- Get all policies for organizations table
    for policy_record in 
        select policyname 
        from pg_policies 
        where schemaname = 'public' 
          and tablename = 'organizations'
    loop
        execute format('drop policy if exists %I on public.organizations cascade', policy_record.policyname);
    end loop;
end $$;

-- Step 5: Re-enable RLS
alter table public.organizations enable row level security;

-- Step 6: Create insert policy - MUST allow all authenticated users
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Step 7: Create select policy
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

-- Step 8: Verify policies were created correctly
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND with_check::text = 'true' THEN '✓ Correct'
        WHEN cmd = 'SELECT' AND qual IS NOT NULL THEN '✓ Correct'
        ELSE '✗ Check needed'
    END as status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd;
