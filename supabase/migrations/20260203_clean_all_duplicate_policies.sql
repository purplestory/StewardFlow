-- Clean up ALL duplicate policies across all tables
-- This is a comprehensive cleanup script

-- Step 1: Show summary before cleanup
SELECT '=== BEFORE CLEANUP ===' as step;
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'profiles', 'assets', 'spaces', 'reservations', 'space_reservations', 'approval_policies', 'notifications', 'audit_logs', 'organization_invites', 'asset_transfer_requests')
GROUP BY tablename
ORDER BY tablename;

-- Step 2: Clean organizations policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Disable RLS
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
    
    -- Drop all policies
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
    
    -- Create clean policies
    CREATE POLICY "organizations_insert_authenticated"
    ON public.organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
    
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
    
    RAISE NOTICE 'Cleaned organizations policies';
END $$;

-- Step 3: Clean profiles policies (check for duplicates)
DO $$
DECLARE
    policy_record RECORD;
    policy_count INTEGER;
BEGIN
    -- Count existing policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles';
    
    -- If more than expected (3: select, insert, update), clean up
    IF policy_count > 3 THEN
        ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
        
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'profiles'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles CASCADE', policy_record.policyname);
        END LOOP;
        
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        -- Recreate standard policies
        CREATE POLICY "profiles_select_own"
        ON public.profiles
        FOR SELECT
        TO authenticated
        USING (id = auth.uid());
        
        CREATE POLICY "profiles_insert_own"
        ON public.profiles
        FOR INSERT
        TO authenticated
        WITH CHECK (id = auth.uid());
        
        CREATE POLICY "profiles_update_own"
        ON public.profiles
        FOR UPDATE
        TO authenticated
        USING (id = auth.uid());
        
        RAISE NOTICE 'Cleaned profiles policies';
    ELSE
        RAISE NOTICE 'Profiles policies look OK (count: %)', policy_count;
    END IF;
END $$;

-- Step 4: Verify final state
SELECT '=== AFTER CLEANUP ===' as step;
SELECT 
    tablename,
    policyname,
    cmd,
    roles::text as roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'profiles')
ORDER BY tablename, cmd, policyname;

-- Step 5: Show policy counts
SELECT '=== FINAL POLICY COUNTS ===' as step;
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'profiles', 'assets', 'spaces', 'reservations', 'space_reservations', 'approval_policies', 'notifications', 'audit_logs', 'organization_invites', 'asset_transfer_requests')
GROUP BY tablename
ORDER BY tablename;
