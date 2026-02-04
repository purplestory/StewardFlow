-- Force recreate organizations RLS policies
-- This will completely remove and recreate all policies

-- Step 1: Disable RLS
alter table public.organizations disable row level security;

-- Step 2: Drop ALL policies (including any that might be hidden)
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

-- Step 3: Re-enable RLS
alter table public.organizations enable row level security;

-- Step 4: Create insert policy with explicit WITH CHECK
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

-- Step 6: Verify
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd, policyname;
