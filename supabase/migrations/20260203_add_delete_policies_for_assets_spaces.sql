-- Add DELETE policies for assets and spaces tables
-- This allows managers and admins to delete assets and spaces

-- Assets DELETE policy
create policy "assets_delete_managers"
on public.assets
for delete
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.is_manager_or_admin()
);

-- Spaces DELETE policy
create policy "spaces_delete_managers"
on public.spaces
for delete
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.is_manager_or_admin()
);
