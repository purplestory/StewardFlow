-- Fix approval_policies insert RLS policy to allow organization creators
-- to create default policies immediately after organization creation
-- This policy allows users who just created an organization (and have admin role)
-- to insert approval policies even if RLS hasn't fully updated yet

-- Drop the existing policy and recreate with a more permissive check
drop policy if exists "approval_policies_insert_same_org" on public.approval_policies;

create policy "approval_policies_insert_same_org"
on public.approval_policies
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and (
    -- Allow if user is manager or admin (normal case)
    public.is_manager_or_admin()
    -- OR allow if user's role is admin (for organization creators)
    or (
      select role from public.profiles where id = auth.uid()
    ) = 'admin'
  )
);
