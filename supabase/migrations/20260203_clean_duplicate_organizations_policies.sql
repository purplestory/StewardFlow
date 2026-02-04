-- Clean up duplicate organizations policies
-- This will remove ALL existing policies and recreate them cleanly

-- Step 1: Show current policies
SELECT '=== CURRENT POLICIES ===' as step;
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    with_check::text as with_check,
    qual::text as using_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY policyname, cmd;

-- Step 2: Disable RLS temporarily
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL existing policies using multiple methods to ensure cleanup
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Method 1: Drop via pg_policies view
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'organizations'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations CASCADE', policy_record.policyname);
            RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping policy %: %', policy_record.policyname, SQLERRM;
        END;
    END LOOP;
    
    -- Method 2: Drop via pg_policy directly (in case view doesn't catch all)
    FOR policy_record IN 
        SELECT pol.polname::text as policyname
        FROM pg_policy pol
        JOIN pg_class pc ON pol.polrelid = pc.oid
        JOIN pg_namespace pn ON pc.relnamespace = pn.oid
        WHERE pn.nspname = 'public' 
          AND pc.relname = 'organizations'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations CASCADE', policy_record.policyname);
            RAISE NOTICE 'Dropped policy (direct): %', policy_record.policyname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping policy (direct) %: %', policy_record.policyname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Step 4: Re-enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify all policies are gone
SELECT '=== AFTER DROP (should be empty) ===' as step;
SELECT 
    policyname,
    cmd,
    roles::text as roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- Step 6: Create clean policies with IF NOT EXISTS (just in case)
-- Insert policy: Allow all authenticated users to create organizations
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
CREATE POLICY "organizations_insert_authenticated"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Select policy: Allow users to see organizations they belong to
DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
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

-- Step 7: Verify final state
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

-- Step 8: Test authentication status
SELECT '=== AUTH TEST ===' as step;
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN 'User is authenticated ✓'
        ELSE 'User is NOT authenticated ✗'
    END as auth_status;
