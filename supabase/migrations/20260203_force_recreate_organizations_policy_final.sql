-- Force recreate organizations policies with explicit role specification
-- This ensures the policies are correctly applied

-- Step 1: Show current state
SELECT '=== BEFORE RECREATE ===' as step;
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

-- Step 2: Completely remove all policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Disable RLS
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
    
    -- Drop all existing policies
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
    
    -- Also try dropping via pg_policy directly
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
    
    -- Re-enable RLS
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'All policies removed, RLS re-enabled';
END $$;

-- Step 3: Verify policies are gone
SELECT '=== AFTER DROP (should be empty) ===' as step;
SELECT 
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations';

-- Step 4: Create policies with EXPLICIT role specification
-- Use DROP IF EXISTS first to avoid conflicts
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;

-- Insert policy: Allow ALL authenticated users to insert
CREATE POLICY "organizations_insert_authenticated"
ON public.organizations
FOR INSERT
TO authenticated  -- Explicitly specify authenticated role
WITH CHECK (true);  -- No conditions, just allow all authenticated users

-- Select policy: Allow users to see organizations they belong to
CREATE POLICY "organizations_select_own"
ON public.organizations
FOR SELECT
TO authenticated  -- Explicitly specify authenticated role
USING (
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Step 5: Verify policies are created
SELECT '=== AFTER RECREATE ===' as step;
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

-- Step 6: Test the policy as authenticated user
SELECT '=== POLICY TEST ===' as step;
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ User is authenticated'
        WHEN auth.role() = 'anon' THEN '⚠️ User is anonymous - need to login'
        ELSE '? Unknown role: ' || auth.role()
    END as auth_status,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ INSERT policy should allow'
        ELSE '✗ INSERT policy will reject'
    END as insert_policy_status;
