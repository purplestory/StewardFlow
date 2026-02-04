-- TEMPORARY: Disable RLS on organizations table for testing
-- WARNING: This is NOT secure and should only be used for debugging
-- After confirming organization creation works, re-enable RLS with proper policies

-- Disable RLS temporarily
alter table public.organizations disable row level security;

-- After testing, you MUST re-enable RLS with:
-- alter table public.organizations enable row level security;
-- Then create the proper policies
