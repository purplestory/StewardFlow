-- Check detailed policy information
-- This will help us understand why the policy is not working

-- Check if RLS is enabled
SELECT 
    'RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- Check all policies with full details
SELECT 
    'Policy Details' as check_type,
    policyname,
    cmd,
    roles::text as roles,
    permissive,
    qual::text as using_clause,
    with_check::text as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd, policyname;

-- Check if there are any conflicting policies
SELECT 
    'Policy Conflicts' as check_type,
    COUNT(*) as policy_count,
    cmd,
    array_agg(policyname) as policy_names
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
GROUP BY cmd;

-- Check the actual policy definition from pg_policy
SELECT 
    'Raw Policy Definition' as check_type,
    pol.polname as policy_name,
    pol.polcmd as command,
    pol.polpermissive as permissive,
    pol.polroles::regrole[]::text[] as roles,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public' 
  AND pc.relname = 'organizations';
