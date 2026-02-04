-- TEMPORARY: Disable RLS on organizations table for testing
-- This will help us confirm that the issue is with RLS policies
-- IMPORTANT: Re-enable RLS after testing!

-- Disable RLS
alter table public.organizations disable row level security;

-- After confirming organization creation works, 
-- you MUST re-enable RLS with proper policies for security
