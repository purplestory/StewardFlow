-- Fix audit_logs RLS policy to allow organization creators
-- to insert audit logs immediately after organization creation
-- This policy allows users who just created an organization
-- to insert audit logs even if RLS hasn't fully updated yet

-- Drop the existing policy and recreate with a more permissive check
drop policy if exists "audit_logs_insert_same_org" on public.audit_logs;

create policy "audit_logs_insert_same_org"
on public.audit_logs
for insert
to authenticated
with check (
  -- Allow if organization_id matches user's profile organization_id
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  -- OR allow if actor_id is the current user (for organization creation logs)
  or actor_id = auth.uid()
);
