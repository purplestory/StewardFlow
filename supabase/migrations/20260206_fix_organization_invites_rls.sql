-- Fix organization_invites RLS policy to handle Server Actions better
-- This adds a fallback similar to approval_policies policy

DROP POLICY IF EXISTS "organization_invites_insert_same_org" ON public.organization_invites;

CREATE POLICY "organization_invites_insert_same_org"
ON public.organization_invites
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  AND (
    -- Allow if user is manager or admin (normal case)
    public.is_manager_or_admin()
    -- OR allow if user's role is admin or manager (for cases where is_manager_or_admin() might not reflect the updated role immediately)
    OR (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'manager')
  )
);
