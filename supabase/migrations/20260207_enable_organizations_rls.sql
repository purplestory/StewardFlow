-- Enable RLS on organizations table and ensure policies are correct
-- This fixes the lint issue: "Policy Exists RLS Disabled"

-- Step 1: Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_admin" ON public.organizations;

-- Step 3: Create INSERT policy - allow all authenticated users to create organizations
CREATE POLICY "organizations_insert_authenticated"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 4: Create SELECT policy - users can only see organizations they belong to
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

-- Step 5: Create UPDATE policy - only admins can update their organization
CREATE POLICY "organizations_update_admin"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
)
WITH CHECK (
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Step 6: Create DELETE policy - only admins can delete their organization
CREATE POLICY "organizations_delete_admin"
ON public.organizations
FOR DELETE
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Step 7: Verify RLS is enabled
DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public' 
    AND tablename = 'organizations';
    
    IF rls_enabled THEN
        RAISE NOTICE '✓ RLS is enabled on public.organizations';
    ELSE
        RAISE EXCEPTION '✗ RLS is still disabled on public.organizations';
    END IF;
END $$;
