-- Completely recreate organizations RLS policies
-- This will fix the 403 error by ensuring policies are correctly set up

-- Step 1: Disable RLS temporarily to clean up
alter table public.organizations disable row level security;

-- Step 2: Drop ALL existing policies (in case there are any hidden ones)
do $$
begin
    -- Drop all policies on organizations table
    execute (
        select string_agg('drop policy if exists ' || quote_ident(pol.policyname) || ' on public.organizations;', ' ')
        from pg_policies pol
        where pol.schemaname = 'public' and pol.tablename = 'organizations'
    );
exception when others then
    -- If no policies exist, that's fine
    null;
end $$;

-- Step 3: Re-enable RLS
alter table public.organizations enable row level security;

-- Step 4: Create insert policy - ALLOW ALL authenticated users to insert
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

-- Step 5: Create select policy - Users can only see organizations they belong to
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

-- Step 6: Verify policies were created
-- You can check with: SELECT * FROM pg_policies WHERE tablename = 'organizations';
