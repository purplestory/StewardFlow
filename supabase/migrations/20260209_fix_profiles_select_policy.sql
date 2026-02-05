-- Fix profiles SELECT policy to allow users in the same organization to see each other
-- This is necessary for user management page to display all organization members

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

-- Create a new policy that allows users to see profiles in the same organization
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Allow if viewing own profile
  id = auth.uid()
  -- OR if viewing profiles in the same organization
  OR organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);
