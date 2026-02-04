-- Ultimate fix for organizations RLS
-- This will completely reset and recreate the policies

-- Step 1: Check current state
SELECT 'Current RLS status:' as info;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations';

SELECT 'Current policies:' as info;
SELECT policyname, cmd, roles, with_check, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'organizations';

-- Step 2: Disable RLS
alter table public.organizations disable row level security;

-- Step 3: Drop ALL policies (including any system policies)
do $$
declare
    r record;
begin
    -- Drop all policies
    for r in (
        select policyname 
        from pg_policies 
        where schemaname = 'public' 
          and tablename = 'organizations'
    ) loop
        execute format('drop policy if exists %I on public.organizations', r.policyname);
    end loop;
    
    -- Also try dropping from pg_policy directly (if exists)
    for r in (
        select pol.polname::text as policyname
        from pg_policy pol
        join pg_class pc on pol.polrelid = pc.oid
        join pg_namespace pn on pc.relnamespace = pn.oid
        where pn.nspname = 'public' 
          and pc.relname = 'organizations'
    ) loop
        execute format('drop policy if exists %I on public.organizations', r.policyname);
    end loop;
end $$;

-- Step 4: Re-enable RLS
alter table public.organizations enable row level security;

-- Step 5: Create insert policy with explicit check
-- Using the simplest possible condition
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

-- Step 7: Final verification
SELECT 'Final policies:' as info;
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check,
    qual::text as qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd;

-- Step 8: Test query to verify RLS is working
-- This should return the authenticated role
SELECT 'Current auth context:' as info;
SELECT auth.uid() as current_user_id, auth.role() as current_role;
