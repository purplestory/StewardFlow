-- TEST: Temporarily disable RLS to verify organization creation works
-- This will help us determine if the issue is with RLS policies or something else
-- IMPORTANT: This is for testing only - re-enable RLS after confirming it works

-- Disable RLS on organizations table
alter table public.organizations disable row level security;

-- After testing and confirming organization creation works, 
-- re-enable RLS with this command:
-- alter table public.organizations enable row level security;
-- Then recreate the policies
