-- Fix potential confusion between 'authenticated' and 'authenticator' roles
-- authenticated = regular authenticated users (what we want)
-- authenticator = Supabase system role (NOT what we want for RLS)

-- Step 1: Check all policies for role usage
SELECT '=== POLICIES WITH ROLE CHECK ===' as step;
SELECT 
    tablename,
    policyname,
    cmd,
    roles::text as roles,
    CASE 
        WHEN roles::text LIKE '%authenticator%' THEN '⚠️ WRONG - uses authenticator'
        WHEN roles::text LIKE '%authenticated%' THEN '✓ OK - uses authenticated'
        ELSE '? Unknown'
    END as role_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    roles::text LIKE '%authenticator%' 
    OR roles::text LIKE '%authenticated%'
  )
ORDER BY tablename, policyname;

-- Step 2: Check organizations policies specifically
SELECT '=== ORGANIZATIONS POLICIES DETAIL ===' as step;
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

-- Step 3: Fix organizations policies if they use wrong role
DO $$
DECLARE
    policy_record RECORD;
    has_wrong_role BOOLEAN := false;
BEGIN
    -- Check if any organizations policy uses 'authenticator' instead of 'authenticated'
    SELECT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'organizations'
          AND roles::text LIKE '%authenticator%'
    ) INTO has_wrong_role;
    
    IF has_wrong_role THEN
        RAISE NOTICE 'Found policies with wrong role (authenticator). Fixing...';
        
        -- Disable RLS
        ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
        
        -- Drop all existing policies
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'organizations'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations CASCADE', policy_record.policyname);
        END LOOP;
        
        -- Re-enable RLS
        ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
        
        -- Create correct policies with 'authenticated' role
        CREATE POLICY "organizations_insert_authenticated"
        ON public.organizations
        FOR INSERT
        TO authenticated  -- ✓ Correct: authenticated (not authenticator)
        WITH CHECK (true);
        
        CREATE POLICY "organizations_select_own"
        ON public.organizations
        FOR SELECT
        TO authenticated  -- ✓ Correct: authenticated (not authenticator)
        USING (
          id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
          )
        );
        
        RAISE NOTICE 'Fixed organizations policies to use authenticated role';
    ELSE
        RAISE NOTICE 'No wrong role found in organizations policies';
    END IF;
END $$;

-- Step 4: Verify all policies use correct role
SELECT '=== FINAL VERIFICATION ===' as step;
SELECT 
    tablename,
    policyname,
    cmd,
    roles::text as roles,
    CASE 
        WHEN roles::text LIKE '%authenticator%' THEN '⚠️ WRONG'
        WHEN roles::text LIKE '%authenticated%' THEN '✓ OK'
        ELSE '?'
    END as role_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'profiles')
ORDER BY tablename, policyname;

-- Step 5: Show role information
SELECT '=== ROLE INFORMATION ===' as step;
SELECT 
    rolname,
    rolsuper as is_superuser,
    rolcanlogin as can_login,
    CASE 
        WHEN rolname = 'authenticated' THEN '✓ User role for authenticated users'
        WHEN rolname = 'authenticator' THEN '⚠️ System role for Supabase auth service'
        ELSE 'Other role'
    END as description
FROM pg_roles
WHERE rolname IN ('authenticated', 'authenticator', 'anon', 'service_role')
ORDER BY rolname;
