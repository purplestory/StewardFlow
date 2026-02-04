-- Final fix for approval_policies RLS policy
-- This policy should allow organization creators to insert policies
-- even if the is_manager_or_admin() function hasn't updated yet

-- Drop the existing policy
drop policy if exists "approval_policies_insert_same_org" on public.approval_policies;

-- Create a more permissive policy that checks role directly
create policy "approval_policies_insert_same_org"
on public.approval_policies
for insert
to authenticated
with check (
  -- Organization must match
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and (
    -- Allow if user's role is admin (direct check, more reliable)
    (
      select role from public.profiles where id = auth.uid()
    ) = 'admin'
    -- OR allow if user is manager or admin (via function, for existing users)
    or public.is_manager_or_admin()
  )
);
