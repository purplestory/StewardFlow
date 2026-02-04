-- Temporarily disable RLS on organizations table to test if insert works
-- This will help us determine if the issue is with RLS policies or something else

-- Step 1: Check current RLS status
SELECT '=== CURRENT RLS STATUS ===' as step;
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename = 'organizations';

-- Step 2: Show current policies
SELECT '=== CURRENT POLICIES ===' as step;
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY cmd, policyname;

-- Step 3: TEMPORARILY disable RLS
-- WARNING: This removes security! Only use for testing!
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Step 4: Verify RLS is disabled
SELECT '=== RLS DISABLED ===' as step;
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = false THEN '✓ RLS is DISABLED - inserts should work now'
        ELSE '✗ RLS is still enabled'
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename = 'organizations';

-- Step 5: Test insert (if you're authenticated)
SELECT '=== TEST INSERT (if authenticated) ===' as step;
DO $$
DECLARE
    test_id uuid;
BEGIN
    IF auth.role() = 'authenticated' THEN
        INSERT INTO public.organizations (name)
        VALUES ('TEST_RLS_DISABLED_' || extract(epoch from now())::text)
        RETURNING id INTO test_id;
        
        IF test_id IS NOT NULL THEN
            RAISE NOTICE '✓ INSERT SUCCESS! ID: %', test_id;
            DELETE FROM public.organizations WHERE id = test_id;
            RAISE NOTICE '✓ Test record deleted';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Cannot test - user is not authenticated';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ INSERT FAILED: %', SQLERRM;
END $$;

-- IMPORTANT: After testing, you should re-enable RLS and fix the policies
-- To re-enable, run:
-- ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
-- Then recreate the policies
