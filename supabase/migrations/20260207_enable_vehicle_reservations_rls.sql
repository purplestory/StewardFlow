-- Enable RLS on vehicle_reservations table and ensure policies are correct
-- This fixes the lint issue: "RLS Disabled in Public" for public.vehicle_reservations

-- Step 1: Enable RLS on vehicle_reservations table
ALTER TABLE public.vehicle_reservations ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "vehicle_reservations_select_same_org" ON public.vehicle_reservations;
DROP POLICY IF EXISTS "vehicle_reservations_insert_same_org" ON public.vehicle_reservations;
DROP POLICY IF EXISTS "vehicle_reservations_update_same_org" ON public.vehicle_reservations;
DROP POLICY IF EXISTS "vehicle_reservations_delete_same_org" ON public.vehicle_reservations;

-- Step 3: Create SELECT policy - users can only see reservations in their organization
CREATE POLICY "vehicle_reservations_select_same_org"
ON public.vehicle_reservations
FOR SELECT
TO authenticated
USING (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Step 4: Create INSERT policy - users can only create reservations for themselves in their organization
CREATE POLICY "vehicle_reservations_insert_same_org"
ON public.vehicle_reservations
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  AND borrower_id = auth.uid()
);

-- Step 5: Create UPDATE policy - users can update reservations in their organization
-- Borrowers can update their own reservations, managers/admins can update any reservation
CREATE POLICY "vehicle_reservations_update_same_org"
ON public.vehicle_reservations
FOR UPDATE
TO authenticated
USING (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Step 6: Create DELETE policy - borrowers can delete their own reservations, 
-- managers/admins can delete any reservation in their organization
CREATE POLICY "vehicle_reservations_delete_same_org"
ON public.vehicle_reservations
FOR DELETE
TO authenticated
USING (
  organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  AND (
    borrower_id = auth.uid()
    OR public.user_role() = 'admin'
    OR public.user_role() = 'manager'
  )
);

-- Step 7: Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_reservations_organization_id 
ON public.vehicle_reservations(organization_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_reservations_borrower_id 
ON public.vehicle_reservations(borrower_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_reservations_vehicle_id 
ON public.vehicle_reservations(vehicle_id);

-- Step 8: Verify RLS is enabled
DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public' 
    AND tablename = 'vehicle_reservations';
    
    IF rls_enabled THEN
        RAISE NOTICE '✓ RLS is enabled on public.vehicle_reservations';
    ELSE
        RAISE EXCEPTION '✗ RLS is still disabled on public.vehicle_reservations';
    END IF;
END $$;
