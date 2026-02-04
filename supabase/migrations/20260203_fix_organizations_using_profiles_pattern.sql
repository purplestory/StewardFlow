-- Fix organizations policies by using the same pattern as profiles
-- profiles works, so let's copy its successful pattern

-- Step 1: Check what works (profiles)
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

-- Step 2: Check what doesn't work (organizations)
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

-- Step 3: Drop and recreate organizations policies using profiles pattern
DO $$
BEGIN
    -- Disable RLS
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
    
    -- Drop all existing policies
    DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
    DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
    DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
    DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
    
    -- Also drop any other potential policies
    DO $$
    DECLARE
        policy_record RECORD;
    BEGIN
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'organizations'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations CASCADE', policy_record.policyname);
        END LOOP;
    END $$;
    
    -- Re-enable RLS
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'All organizations policies dropped';
END $$;

-- Step 4: Create policies using the EXACT same pattern as profiles
-- Profiles uses: TO authenticated with simple conditions
-- Let's do the same for organizations

-- Insert policy: Use same pattern as profiles_insert_own
CREATE POLICY "organizations_insert_authenticated"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Simple true condition like profiles

-- Select policy: Use same pattern as profiles_select_own  
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

-- Step 5: Verify the new policies
SELECT '=== NEW ORGANIZATIONS POLICIES ===' as step;
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

-- Step 6: Compare side by side
SELECT '=== SIDE BY SIDE COMPARISON ===' as step;
SELECT 
    'profiles' as table_name,
    'profiles_insert_own' as policy_name,
    'INSERT' as cmd,
    roles::text as roles,
    with_check::text as with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND cmd = 'INSERT'
UNION ALL
SELECT 
    'organizations' as table_name,
    'organizations_insert_authenticated' as policy_name,
    'INSERT' as cmd,
    roles::text as roles,
    with_check::text as with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
  AND cmd = 'INSERT'
ORDER BY table_name;

-- Step 7: Test authentication
SELECT '=== AUTHENTICATION STATUS ===' as step;
SELECT 
    auth.uid() as user_id,
    auth.role() as role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Should work for both tables'
        ELSE '✗ Not authenticated - this is the problem'
    END as status;
