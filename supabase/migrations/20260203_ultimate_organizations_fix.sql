-- Ultimate fix: Completely recreate organizations RLS from scratch
-- Since profiles works, we'll use the exact same approach

-- Step 1: Nuclear option - drop everything
DO $$
BEGIN
    -- Disable RLS
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
    
    -- Drop ALL policies (try every possible name)
    DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations CASCADE;
    DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations CASCADE;
    DROP POLICY IF EXISTS "organizations_insert" ON public.organizations CASCADE;
    DROP POLICY IF EXISTS "organizations_select" ON public.organizations CASCADE;
    
    -- Drop any remaining policies
    DO $$
    DECLARE
        pol RECORD;
    BEGIN
        FOR pol IN 
            SELECT polname::text as name
            FROM pg_policy p
            JOIN pg_class c ON p.polrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = 'organizations'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations CASCADE', pol.name);
        END LOOP;
    END $$;
    
    -- Re-enable RLS
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'All policies dropped, RLS re-enabled';
END $$;

-- Step 2: Verify clean slate
SELECT '=== VERIFY CLEAN SLATE ===' as step;
SELECT COUNT(*) as remaining_policies
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- Step 3: Create INSERT policy - SIMPLEST POSSIBLE
-- No conditions, just allow authenticated users
CREATE POLICY "organizations_insert_authenticated"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 4: Create SELECT policy
CREATE POLICY "organizations_select_own"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Step 5: Verify policies created
SELECT '=== VERIFY POLICIES CREATED ===' as step;
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

-- Step 6: Test as authenticated user (if you're logged in)
SELECT '=== TEST AS AUTHENTICATED USER ===' as step;
SELECT 
    auth.uid() as user_id,
    auth.role() as role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Ready to test insert'
        WHEN auth.role() = 'anon' THEN '⚠️ Need to login first'
        ELSE '? Role: ' || auth.role()
    END as status;

-- Step 7: Try actual insert test
DO $$
DECLARE
    test_id uuid;
BEGIN
    -- Only test if authenticated
    IF auth.role() = 'authenticated' THEN
        INSERT INTO public.organizations (name)
        VALUES ('TEST_' || extract(epoch from now())::text)
        RETURNING id INTO test_id;
        
        IF test_id IS NOT NULL THEN
            RAISE NOTICE '✓ INSERT TEST SUCCESS! ID: %', test_id;
            DELETE FROM public.organizations WHERE id = test_id;
            RAISE NOTICE '✓ Test record deleted';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Cannot test - user is not authenticated';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ INSERT TEST FAILED: %', SQLERRM;
    RAISE NOTICE 'Error Code: %', SQLSTATE;
END $$;
