-- RLS 정책은 organization_id가 채워진 이후에 적용하세요.
-- 적용 전 필수:
-- 1) profiles.organization_id 설정
-- 2) assets/spaces/reservations/space_reservations 등에 organization_id 입력

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.spaces enable row level security;
alter table public.vehicles enable row level security;
alter table public.reservations enable row level security;
alter table public.space_reservations enable row level security;
alter table public.vehicle_reservations enable row level security;
alter table public.approval_policies enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.organization_invites enable row level security;
alter table public.asset_transfer_requests enable row level security;
alter table public.departments enable row level security;

-- 권한 판단용 함수
create or replace function public.role_rank(role text)
returns int
language sql
stable
as $$
  select case role
    when 'admin' then 3
    when 'manager' then 2
    when 'user' then 1
    else 0
  end;
$$;

create or replace function public.user_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.required_role_for_asset(asset_id uuid)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select ap.required_role
      from public.approval_policies ap
      join public.assets a on a.id = asset_id
      where ap.organization_id = a.organization_id
        and ap.scope = 'asset'
        and ap.department = case when a.owner_scope = 'organization' then null else a.owner_department end
      limit 1
    ),
    (
      select ap.required_role
      from public.approval_policies ap
      join public.assets a on a.id = asset_id
      where ap.organization_id = a.organization_id
        and ap.scope = 'asset'
        and ap.department is null
      limit 1
    ),
    'manager'
  );
$$;

create or replace function public.required_role_for_space(space_id uuid)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select ap.required_role
      from public.approval_policies ap
      join public.spaces s on s.id = space_id
      where ap.organization_id = s.organization_id
        and ap.scope = 'space'
        and ap.department = case when s.owner_scope = 'organization' then null else s.owner_department end
      limit 1
    ),
    (
      select ap.required_role
      from public.approval_policies ap
      join public.spaces s on s.id = space_id
      where ap.organization_id = s.organization_id
        and ap.scope = 'space'
        and ap.department is null
      limit 1
    ),
    'manager'
  );
$$;

create or replace function public.can_approve_asset(asset_id uuid)
returns boolean
language sql
stable
as $$
  select public.role_rank(public.user_role()) >= public.role_rank(public.required_role_for_asset(asset_id));
$$;

create or replace function public.can_approve_space(space_id uuid)
returns boolean
language sql
stable
as $$
  select public.role_rank(public.user_role()) >= public.role_rank(public.required_role_for_space(space_id));
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
as $$
  select public.role_rank(public.user_role()) >= public.role_rank('manager');
$$;

-- profiles: 본인 정보만 조회/수정/생성
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid());

-- organizations: 모든 인증된 사용자가 생성 가능, 본인이 속한 조직만 조회
alter table public.organizations enable row level security;

create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

create policy "organizations_select_own"
on public.organizations
for select
to authenticated
using (
  id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "organizations_update_admin"
on public.organizations
for update
to authenticated
using (
  id in (
    select organization_id from public.profiles 
    where id = auth.uid() and role = 'admin'
  )
);

create policy "organizations_delete_admin"
on public.organizations
for delete
to authenticated
using (
  id in (
    select organization_id from public.profiles 
    where id = auth.uid() and role = 'admin'
  )
);

-- 공통: 같은 organization_id만 접근
create policy "assets_select_same_org"
on public.assets
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "assets_insert_same_org"
on public.assets
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "assets_update_same_org"
on public.assets
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

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

create policy "spaces_select_same_org"
on public.spaces
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "spaces_insert_same_org"
on public.spaces
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "spaces_update_same_org"
on public.spaces
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

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

create policy "reservations_select_same_org"
on public.reservations
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "reservations_insert_same_org"
on public.reservations
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "reservations_update_same_org"
on public.reservations
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.can_approve_asset(asset_id)
);

create policy "space_reservations_select_same_org"
on public.space_reservations
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "space_reservations_insert_same_org"
on public.space_reservations
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "space_reservations_update_same_org"
on public.space_reservations
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.can_approve_space(space_id)
);

create policy "approval_policies_select_same_org"
on public.approval_policies
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

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
    -- This handles the case where is_manager_or_admin() might not reflect
    -- the updated role immediately after profile update
    or (
      select role from public.profiles where id = auth.uid()
    ) = 'admin'
  )
);

create policy "approval_policies_update_same_org"
on public.approval_policies
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.is_manager_or_admin()
);

create policy "approval_policies_delete_same_org"
on public.approval_policies
for delete
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.is_manager_or_admin()
);

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid() and
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "notifications_insert_same_org"
on public.notifications
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "audit_logs_select_same_org"
on public.audit_logs
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

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
  -- This handles the case where organization_id might not be updated in profile yet
  or actor_id = auth.uid()
);

create policy "organization_invites_select_own"
on public.organization_invites
for select
to authenticated
using (
  email = (auth.jwt() ->> 'email')
  or organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "organization_invites_insert_same_org"
on public.organization_invites
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.is_manager_or_admin()
);

create policy "organization_invites_update_accept"
on public.organization_invites
for update
to authenticated
using (
  email = (auth.jwt() ->> 'email')
);

create policy "organization_invites_update_same_org"
on public.organization_invites
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and public.is_manager_or_admin()
);

create policy "asset_transfer_requests_select_same_org"
on public.asset_transfer_requests
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and (
    requester_id = auth.uid()
    or public.is_manager_or_admin()
    or from_department = (select department from public.profiles where id = auth.uid())
    or to_department = (select department from public.profiles where id = auth.uid())
  )
);

create policy "asset_transfer_requests_insert_same_org"
on public.asset_transfer_requests
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and requester_id = auth.uid()
);

create policy "asset_transfer_requests_update_same_org"
on public.asset_transfer_requests
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and (
    public.is_manager_or_admin()
    or from_department = (select department from public.profiles where id = auth.uid())
    or requester_id = auth.uid()
  )
);

-- departments: 같은 조직 내에서만 조회/생성/수정/삭제
create policy "departments_select_own_org"
on public.departments
for select
to authenticated
using (
  organization_id in (
    select organization_id 
    from public.profiles 
    where id = auth.uid()
  )
);

create policy "departments_insert_managers"
on public.departments
for insert
to authenticated
with check (
  organization_id in (
    select organization_id 
    from public.profiles 
    where id = auth.uid()
      and role in ('admin', 'manager')
  )
);

create policy "departments_update_managers"
on public.departments
for update
to authenticated
using (
  organization_id in (
    select organization_id 
    from public.profiles 
    where id = auth.uid()
      and role in ('admin', 'manager')
  )
);

create policy "departments_delete_admins"
on public.departments
for delete
to authenticated
using (
  organization_id in (
    select organization_id 
    from public.profiles 
    where id = auth.uid()
      and role = 'admin'
  )
);
