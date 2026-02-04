-- Re-enable RLS and create correct policies
-- Run this after confirming that insert works with RLS disabled

-- Step 1: Re-enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies completely
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Disable RLS temporarily to drop policies
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
    
    -- Drop all policies
    FOR pol IN 
        SELECT polname::text as name
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = 'organizations'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations CASCADE', pol.name);
            RAISE NOTICE 'Dropped policy: %', pol.name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping policy %: %', pol.name, SQLERRM;
        END;
    END LOOP;
    
    -- Also drop via pg_policies view
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'organizations'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations CASCADE', pol.policyname);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    -- Re-enable RLS
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'All policies dropped, RLS re-enabled';
END $$;

-- Step 3: Verify policies are gone
SELECT '=== VERIFY POLICIES DROPPED ===' as step;
SELECT COUNT(*) as remaining_policies
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- Step 4: Create INSERT policy - SIMPLEST POSSIBLE
CREATE POLICY "organizations_insert_authenticated"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 5: Create SELECT policy
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

-- Step 6: Verify final state
SELECT '=== FINAL POLICIES ===' as step;
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

-- Step 7: Test authentication
SELECT '=== AUTH TEST ===' as step;
SELECT 
    auth.uid() as user_id,
    auth.role() as role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Ready to test'
        ELSE '✗ Not authenticated'
    END as status;
