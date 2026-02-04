-- TEMPORARY: Disable RLS on organizations table
-- This is ONLY for debugging - organization creation should work after this
-- After confirming it works, we'll re-enable RLS with proper policies

-- Disable RLS
alter table public.organizations disable row level security;

-- After testing, run this to re-enable:
-- alter table public.organizations enable row level security;
-- Then recreate the policies
