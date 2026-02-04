-- Enable RLS for vehicles and vehicle_reservations
alter table public.vehicles enable row level security;
alter table public.vehicle_reservations enable row level security;

-- Vehicles SELECT policy
create policy "vehicles_select_same_org"
on public.vehicles
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

-- Vehicles INSERT policy
create policy "vehicles_insert_same_org"
on public.vehicles
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and (
    public.user_role() = 'admin'
    or public.user_role() = 'manager'
  )
);

-- Vehicles UPDATE policy
create policy "vehicles_update_same_org"
on public.vehicles
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and (
    public.user_role() = 'admin'
    or public.user_role() = 'manager'
  )
);

-- Vehicles DELETE policy
create policy "vehicles_delete_managers"
on public.vehicles
for delete
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.is_manager_or_admin()
);

-- Vehicle reservations SELECT policy
create policy "vehicle_reservations_select_same_org"
on public.vehicle_reservations
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

-- Vehicle reservations INSERT policy
create policy "vehicle_reservations_insert_same_org"
on public.vehicle_reservations
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and borrower_id = auth.uid()
);

-- Vehicle reservations UPDATE policy
create policy "vehicle_reservations_update_same_org"
on public.vehicle_reservations
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

-- Vehicle reservations DELETE policy
create policy "vehicle_reservations_delete_same_org"
on public.vehicle_reservations
for delete
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and (
    borrower_id = auth.uid()
    or public.user_role() = 'admin'
    or public.user_role() = 'manager'
  )
);

-- Add required_role_for_vehicle function
create or replace function public.required_role_for_vehicle(vehicle_id uuid)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select ap.required_role
      from public.approval_policies ap
      join public.vehicles v on v.id = vehicle_id
      where ap.organization_id = v.organization_id
        and ap.scope = 'vehicle'
        and ap.department = case when v.owner_scope = 'organization' then null else v.owner_department end
      limit 1
    ),
    (
      select ap.required_role
      from public.approval_policies ap
      join public.vehicles v on v.id = vehicle_id
      where ap.organization_id = v.organization_id
        and ap.scope = 'vehicle'
        and ap.department is null
      limit 1
    ),
    'manager'
  );
$$;

-- Add can_approve_vehicle function
create or replace function public.can_approve_vehicle(vehicle_id uuid)
returns boolean
language sql
stable
as $$
  select public.role_rank(public.user_role()) >= public.role_rank(public.required_role_for_vehicle(vehicle_id));
$$;
