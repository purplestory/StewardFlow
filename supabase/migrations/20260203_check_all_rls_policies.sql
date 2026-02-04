-- Check all RLS policies across all tables
-- This will help identify duplicate policies

-- Step 1: Check organizations policies
SELECT '=== ORGANIZATIONS POLICIES ===' as step;
SELECT 
    tablename,
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check,
    qual::text as using_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY policyname, cmd;

-- Step 2: Check profiles policies
SELECT '=== PROFILES POLICIES ===' as step;
SELECT 
    tablename,
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check,
    qual::text as using_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY policyname, cmd;

-- Step 3: Check all tables with RLS enabled
SELECT '=== TABLES WITH RLS ENABLED ===' as step;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;

-- Step 4: Count policies per table
SELECT '=== POLICY COUNT PER TABLE ===' as step;
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(DISTINCT cmd::text, ', ' ORDER BY cmd::text) as commands,
    STRING_AGG(DISTINCT policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Step 5: Find duplicate policy names (same name, different tables is OK, but same name on same table is BAD)
SELECT '=== POTENTIAL DUPLICATE POLICIES (same name on same table) ===' as step;
SELECT 
    tablename,
    policyname,
    COUNT(*) as occurrence_count,
    STRING_AGG(DISTINCT cmd::text, ', ' ORDER BY cmd::text) as commands
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename, policyname
HAVING COUNT(*) > 1
ORDER BY tablename, policyname;

-- Step 6: Check for policies with same command on same table (potential conflicts)
SELECT '=== POLICIES WITH SAME COMMAND ON SAME TABLE ===' as step;
SELECT 
    tablename,
    cmd,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- Step 7: List all policies for critical tables
SELECT '=== ALL POLICIES FOR CRITICAL TABLES ===' as step;
SELECT 
    tablename,
    policyname,
    cmd,
    roles::text as roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'profiles', 'assets', 'spaces', 'reservations')
ORDER BY tablename, cmd, policyname;
