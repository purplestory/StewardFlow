-- Compare profiles and organizations policies
-- profiles works, organizations doesn't - let's see the difference

-- Step 1: Check profiles policies (this works)
SELECT '=== PROFILES POLICIES (WORKS) ===' as step;
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check,
    qual::text as using_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Step 2: Check organizations policies (this doesn't work)
SELECT '=== ORGANIZATIONS POLICIES (DOES NOT WORK) ===' as step;
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check,
    qual::text as using_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd, policyname;

-- Step 3: Check RLS status
SELECT '=== RLS STATUS ===' as step;
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'organizations')
ORDER BY tablename;

-- Step 4: Test current user authentication
SELECT '=== AUTHENTICATION TEST ===' as step;
SELECT 
    auth.uid() as user_id,
    auth.role() as role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Authenticated'
        WHEN auth.role() = 'anon' THEN '✗ Anonymous'
        ELSE '? ' || auth.role()
    END as status;

-- Step 5: Test profiles update (this works)
SELECT '=== TEST PROFILES UPDATE (SHOULD WORK) ===' as step;
-- This simulates what happens when updating department
SELECT 
    'profiles_update_own' as policy_name,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Role check: PASS'
        ELSE '✗ Role check: FAIL'
    END as role_check,
    CASE 
        WHEN auth.uid() IS NOT NULL THEN '✓ User ID exists'
        ELSE '✗ No user ID'
    END as user_check;

-- Step 6: Test organizations insert (this doesn't work)
SELECT '=== TEST ORGANIZATIONS INSERT (DOES NOT WORK) ===' as step;
SELECT 
    'organizations_insert_authenticated' as policy_name,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Role check: PASS'
        ELSE '✗ Role check: FAIL - role is: ' || COALESCE(auth.role(), 'NULL')
    END as role_check,
    CASE 
        WHEN true THEN '✓ with_check condition: PASS (always true)'
        ELSE '✗ with_check condition: FAIL'
    END as condition_check;

-- Step 7: Check if there are any conflicting policies
SELECT '=== CHECK FOR CONFLICTS ===' as step;
SELECT 
    tablename,
    cmd,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'organizations'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1;
