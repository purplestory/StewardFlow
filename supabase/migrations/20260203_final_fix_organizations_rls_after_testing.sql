-- Final fix: Re-enable RLS and create correct policies
-- Run this AFTER testing with RLS disabled

-- Step 1: Re-enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies
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

-- Step 3: Create INSERT policy with EXPLICIT role and SIMPLE condition
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

-- Step 5: Verify
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

-- Step 6: Test authentication
SELECT '=== AUTH TEST ===' as step;
SELECT 
    auth.uid() as user_id,
    auth.role() as role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Should work'
        ELSE '✗ Not authenticated'
    END as status;
