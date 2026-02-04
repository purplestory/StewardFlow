-- Nuclear option: Complete reset of organizations RLS
-- This will completely remove and recreate everything

-- Step 1: Disable RLS
alter table public.organizations disable row level security;

-- Step 2: Drop ALL policies using multiple methods to ensure they're gone
-- Method 1: Drop via pg_policies
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
        execute format('drop policy if exists %I on public.organizations cascade', r.policyname);
    end loop;
end $$;

-- Method 2: Drop via pg_policy directly
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
        execute format('drop policy if exists %I on public.organizations cascade', r.policyname);
    end loop;
end $$;

-- Step 3: Wait a moment (PostgreSQL doesn't have sleep, but we can use a dummy query)
-- This gives time for any locks to clear
SELECT pg_sleep(0.1);

-- Step 4: Re-enable RLS
alter table public.organizations enable row level security;

-- Step 5: Create insert policy with the absolute simplest condition
-- No conditions, just allow authenticated users
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

-- Step 7: Force a table refresh (this might help with caching)
NOTIFY pgrst, 'reload schema';

-- Step 8: Verify
SELECT 
    policyname,
    cmd,
    roles::text,
    with_check::text,
    CASE 
        WHEN cmd = 'INSERT' AND with_check::text = 'true' THEN '✓'
        ELSE '✗'
    END as verified
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';
