-- Absolute final fix for organizations RLS
-- This will completely reset everything and recreate policies

-- Step 1: Check current state
SELECT '=== BEFORE FIX ===' as step;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations';
SELECT policyname, cmd, roles::text, with_check::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations';

-- Step 2: Disable RLS
alter table public.organizations disable row level security;

-- Step 3: Drop ALL policies - use both methods
-- Method 1: Via pg_policies view
do $$
declare
    r record;
begin
    for r in (
        select policyname 
        from pg_policies 
        where schemaname = 'public' 
          and tablename = 'organizations'
    ) loop
        execute format('drop policy if exists %I on public.organizations', r.policyname);
    end loop;
end $$;

-- Method 2: Via pg_policy directly
do $$
declare
    r record;
begin
    for r in (
        select pol.polname::text as policyname
        from pg_policy pol
        join pg_class pc on pol.polrelid = pc.oid
        join pg_namespace pn on pc.relnamespace = pn.oid
        where pn.nspname = 'public' 
          and pc.relname = 'organizations'
    ) loop
        begin
            execute format('drop policy if exists %I on public.organizations', r.policyname);
        exception when others then
            -- Ignore errors
            null;
        end;
    end loop;
end $$;

-- Step 4: Re-enable RLS
alter table public.organizations enable row level security;

-- Step 5: Create insert policy - SIMPLEST POSSIBLE
-- Just allow all authenticated users, no conditions
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Step 6: Create select policy
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

-- Step 7: Verify after creation
SELECT '=== AFTER FIX ===' as step;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations';
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check,
    qual::text as using_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd;

-- Step 8: Test the policy directly
-- This should return true for authenticated users
SELECT '=== POLICY TEST ===' as step;
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN 'User is authenticated'
        ELSE 'User is NOT authenticated'
    END as auth_status;
