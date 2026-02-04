-- Final setup: Re-enable RLS on organizations table with proper policies
-- This should work now that we've confirmed organization creation works without RLS

-- Step 1: Enable RLS
alter table public.organizations enable row level security;

-- Step 2: Drop ALL existing policies (if any)
do $$
declare
    policy_record record;
begin
    for policy_record in 
        select policyname 
        from pg_policies 
        where schemaname = 'public' 
          and tablename = 'organizations'
    loop
        execute format('drop policy if exists %I on public.organizations cascade', policy_record.policyname);
    end loop;
end $$;

-- Step 3: Create insert policy - Allow ALL authenticated users to insert
-- This is critical for organization creation
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Step 4: Create select policy - Users can only see organizations they belong to
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

-- Step 5: Verify the policies
SELECT 
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'INSERT' THEN with_check::text
        WHEN cmd = 'SELECT' THEN qual::text
        ELSE NULL
    END as condition,
    CASE 
        WHEN cmd = 'INSERT' AND with_check::text = 'true' THEN '✓ INSERT policy correct'
        WHEN cmd = 'SELECT' AND qual IS NOT NULL THEN '✓ SELECT policy correct'
        ELSE '✗ Policy needs checking'
    END as status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd;
