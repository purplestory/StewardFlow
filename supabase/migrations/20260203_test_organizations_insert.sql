-- Test organizations insert policy
-- This will help diagnose why insert is failing

-- Step 1: Check current user authentication status
SELECT '=== AUTHENTICATION STATUS ===' as step;
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    auth.jwt() ->> 'email' as user_email,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ User is authenticated'
        WHEN auth.role() = 'anon' THEN '⚠️ User is anonymous (not logged in)'
        ELSE '? Unknown role: ' || auth.role()
    END as auth_status;

-- Step 2: Check if user has a profile
SELECT '=== USER PROFILE ===' as step;
SELECT 
    id,
    email,
    organization_id,
    role,
    name,
    department
FROM public.profiles
WHERE id = auth.uid();

-- Step 3: Test if insert policy allows the operation
-- This simulates what happens when you try to insert
SELECT '=== POLICY TEST (INSERT) ===' as step;
SELECT 
    'organizations_insert_authenticated' as policy_name,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ User has authenticated role'
        ELSE '✗ User does NOT have authenticated role'
    END as role_check,
    CASE 
        WHEN auth.role() = 'authenticated' AND true THEN '✓ Policy condition (with_check: true) would PASS'
        ELSE '✗ Policy condition would FAIL'
    END as policy_check;

-- Step 4: Try to actually insert (this will show the error if it fails)
SELECT '=== ACTUAL INSERT TEST ===' as step;
-- Note: This will only work if you're authenticated
-- If you get an error, it will show the exact reason

DO $$
DECLARE
    test_org_id uuid;
    insert_success boolean := false;
BEGIN
    -- Try to insert a test organization
    INSERT INTO public.organizations (name)
    VALUES ('TEST_ORG_' || extract(epoch from now())::text)
    RETURNING id INTO test_org_id;
    
    IF test_org_id IS NOT NULL THEN
        RAISE NOTICE '✓ INSERT SUCCESS! Created organization: %', test_org_id;
        -- Clean up test organization
        DELETE FROM public.organizations WHERE id = test_org_id;
        RAISE NOTICE '✓ Test organization deleted';
        insert_success := true;
    END IF;
    
    IF NOT insert_success THEN
        RAISE NOTICE '✗ INSERT FAILED - Check error message above';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ INSERT ERROR: %', SQLERRM;
    RAISE NOTICE 'Error Code: %', SQLSTATE;
END $$;

-- Step 5: Check RLS status on organizations table
SELECT '=== RLS STATUS ===' as step;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename = 'organizations';

-- Step 6: Verify policies are active
SELECT '=== ACTIVE POLICIES ===' as step;
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    CASE 
        WHEN cmd = 'INSERT' THEN with_check::text
        WHEN cmd = 'SELECT' THEN qual::text
        ELSE 'N/A'
    END as policy_condition
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd, policyname;
