-- Enable RLS on vehicles table and ensure policies are correct
-- This fixes the lint issue: "RLS Disabled in Public" for public.vehicles

-- Step 1: Enable RLS on vehicles table
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "vehicles_select_same_org" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert_same_org" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update_same_org" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete_managers" ON public.vehicles;

-- Step 3: Create SELECT policy - users can only see vehicles in their organization
CREATE POLICY "vehicles_select_same_org"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Step 4: Create INSERT policy - managers/admins can insert vehicles in their organization
CREATE POLICY "vehicles_insert_same_org"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  AND (
    public.user_role() = 'admin'
    OR public.user_role() = 'manager'
  )
);

-- Step 5: Create UPDATE policy - managers/admins can update vehicles in their organization
CREATE POLICY "vehicles_update_same_org"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  AND (
    public.user_role() = 'admin'
    OR public.user_role() = 'manager'
  )
)
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  AND (
    public.user_role() = 'admin'
    OR public.user_role() = 'manager'
  )
);

-- Step 6: Create DELETE policy - only managers/admins can delete vehicles
CREATE POLICY "vehicles_delete_managers"
ON public.vehicles
FOR DELETE
TO authenticated
USING (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  AND public.is_manager_or_admin()
);

-- Step 7: Ensure organization_id index exists for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id 
ON public.vehicles(organization_id);

-- Step 8: Verify RLS is enabled
DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public' 
    AND tablename = 'vehicles';
    
    IF rls_enabled THEN
        RAISE NOTICE '✓ RLS is enabled on public.vehicles';
    ELSE
        RAISE EXCEPTION '✗ RLS is still disabled on public.vehicles';
    END IF;
END $$;
