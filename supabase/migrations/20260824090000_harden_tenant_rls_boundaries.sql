-- Harden tenant boundaries for profiles, invitations, and admin-only data.
--
-- Why this migration exists:
--   * A row-level UPDATE policy cannot restrict which columns are changed. The
--     former profiles_update_own policy therefore allowed a user to change
--     role and organization_id on their own row.
--   * The former anon invite policy exposed every active invitation because an
--     RLS policy cannot inspect the token filter supplied by the client.
--   * Several "admin" policies treated an organization admin as a platform
--     admin and exposed rows belonging to other organizations.
--
-- This migration is intentionally idempotent. It does not edit migration
-- history and can be reapplied while validating a recovered environment.

begin;

-- ---------------------------------------------------------------------------
-- 1. Non-recursive, tenant-aware authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.get_user_organization_id()
returns uuid
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select p.organization_id
  from public.profiles as p
  where p.id = auth.uid()
  limit 1;
$function$;

create or replace function public.is_user_admin()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.organization_id is not null
      and p.role = 'admin'
  );
$function$;

create or replace function public.is_user_admin_for_org(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select target_organization_id is not null
    and exists (
      select 1
      from public.profiles as p
      where p.id = auth.uid()
        and p.organization_id = target_organization_id
        and p.role = 'admin'
    );
$function$;

create or replace function public.is_user_manager_or_admin_for_org(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select target_organization_id is not null
    and exists (
      select 1
      from public.profiles as p
      where p.id = auth.uid()
        and p.organization_id = target_organization_id
        and p.role in ('admin', 'manager')
    );
$function$;

create or replace function public.is_user_manager_for_department(
  target_organization_id uuid,
  target_department text
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select target_organization_id is not null
    and target_department is not null
    and exists (
      select 1
      from public.profiles as p
      where p.id = auth.uid()
        and p.organization_id = target_organization_id
        and p.department = target_department
        and p.role = 'manager'
    );
$function$;

create or replace function public.has_valid_email_invite_for_current_user(
  target_organization_id uuid,
  target_role text,
  target_department text
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select target_organization_id is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and exists (
      select 1
      from public.organization_invites as oi
      where oi.organization_id = target_organization_id
        and oi.email is not null
        and lower(trim(oi.email)) = lower(trim(auth.jwt() ->> 'email'))
        and coalesce(oi.role, 'user') = coalesce(target_role, 'user')
        and oi.department is not distinct from target_department
        and oi.accepted_at is null
        and oi.revoked_at is null
        and oi.expires_at > now()
    );
$function$;

revoke all on function public.get_user_organization_id() from public, anon;
revoke all on function public.is_user_admin() from public, anon;
revoke all on function public.is_user_admin_for_org(uuid) from public, anon;
revoke all on function public.is_user_manager_or_admin_for_org(uuid) from public, anon;
revoke all on function public.is_user_manager_for_department(uuid, text) from public, anon;
revoke all on function public.has_valid_email_invite_for_current_user(uuid, text, text) from public, anon;

grant execute on function public.get_user_organization_id() to authenticated, service_role;
grant execute on function public.is_user_admin() to authenticated, service_role;
grant execute on function public.is_user_admin_for_org(uuid) to authenticated, service_role;
grant execute on function public.is_user_manager_or_admin_for_org(uuid) to authenticated, service_role;
grant execute on function public.is_user_manager_for_department(uuid, text) to authenticated, service_role;
grant execute on function public.has_valid_email_invite_for_current_user(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Profiles: safe defaults, tenant-bound policies, and column-level guard
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

alter table public.profiles
  add column if not exists privilege_version bigint not null default 0;
alter table public.profiles alter column role set default 'user';

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_same_org" on public.profiles;
drop policy if exists "profiles_select_all_by_admin" on public.profiles;
drop policy if exists "profiles_select_pending_users_by_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin_same_org" on public.profiles;
drop policy if exists "profiles_update_manager_same_dept" on public.profiles;
drop policy if exists "profiles_update_pending_users_by_admin" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_select_same_org"
on public.profiles
for select
to authenticated
using (
  organization_id is not null
  and organization_id = public.get_user_organization_id()
);

-- A new user may create an unassigned user profile. An email-specific invite
-- may also bootstrap a profile; generic token invites continue through the
-- existing server action, which uses service_role after validating the token.
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and (
    (
      organization_id is null
      and role = 'user'
      and department is null
    )
    or (
      organization_id is not null
      and role in ('admin', 'manager', 'user')
      and public.has_valid_email_invite_for_current_user(organization_id, role, department)
    )
  )
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_update_admin_same_org"
on public.profiles
for update
to authenticated
using (
  organization_id is not null
  and public.is_user_admin_for_org(organization_id)
)
with check (
  organization_id is not null
  and public.is_user_admin_for_org(organization_id)
);

create policy "profiles_update_manager_same_dept"
on public.profiles
for update
to authenticated
using (
  role <> 'admin'
  and public.is_user_manager_for_department(organization_id, department)
)
with check (
  role <> 'admin'
  and public.is_user_manager_for_department(organization_id, department)
);

create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  actor_department text;
  actor_role text;
  jwt_email text := nullif(trim(auth.jwt() ->> 'email'), '');
begin
  -- Service-role calls are server-side trusted paths. RLS is bypassed by that
  -- role, but triggers are not, so it must be handled explicitly.
  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if actor_id is null then
    raise exception 'profile mutation requires an authenticated user'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from actor_id then
      raise exception 'a profile can only be created for the authenticated user'
        using errcode = '42501';
    end if;

    if jwt_email is not null and lower(trim(new.email)) is distinct from lower(jwt_email) then
      raise exception 'profile email must match the authenticated identity'
        using errcode = '42501';
    end if;

    if new.organization_id is null then
      if new.role is distinct from 'user' or new.department is not null then
        raise exception 'an unassigned profile must start with the user role and no department'
          using errcode = '42501';
      end if;
    elsif new.role is null
       or new.role not in ('admin', 'manager', 'user')
       or not public.has_valid_email_invite_for_current_user(
         new.organization_id,
         new.role,
         new.department
       ) then
      raise exception 'organization assignment requires a valid invitation'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if actor_id = old.id then
    -- Default-deny every current or future column except the two explicitly
    -- user-editable profile fields and the controlled invite acceptance fields.
    if (to_jsonb(new) - array['name', 'phone', 'organization_id', 'role', 'department'])
       is distinct from
       (to_jsonb(old) - array['name', 'phone', 'organization_id', 'role', 'department']) then
      raise exception 'users may only edit name and phone outside invitation acceptance'
        using errcode = '42501';
    end if;

    if new.organization_id is distinct from old.organization_id
       or new.role is distinct from old.role
       or new.department is distinct from old.department then
      if old.organization_id is not null
         or new.organization_id is null
         or new.role is null
         or new.role not in ('admin', 'manager', 'user')
         or not public.has_valid_email_invite_for_current_user(
           new.organization_id,
           new.role,
           new.department
         ) then
        raise exception 'role and organization can only change through a valid invitation'
          using errcode = '42501';
      end if;
    end if;

    return new;
  end if;

  select p.organization_id, p.department, p.role
    into actor_organization_id, actor_department, actor_role
  from public.profiles as p
  where p.id = actor_id
  limit 1;

  if actor_role = 'admin'
     and actor_organization_id is not null
     and old.organization_id = actor_organization_id
     and new.organization_id = actor_organization_id then
    if (to_jsonb(new) - array['name', 'phone', 'department', 'role'])
       is distinct from
       (to_jsonb(old) - array['name', 'phone', 'department', 'role']) then
      raise exception 'organization admins cannot change profile identity or tenant ownership'
        using errcode = '42501';
    end if;

    if new.role is null or new.role not in ('admin', 'manager', 'user') then
      raise exception 'invalid profile role'
        using errcode = '22023';
    end if;

    return new;
  end if;

  if actor_role = 'manager'
     and actor_organization_id is not null
     and actor_department is not null
     and old.organization_id = actor_organization_id
     and new.organization_id = actor_organization_id
     and old.department = actor_department
     and new.department = actor_department
     and old.role <> 'admin'
     and new.role <> 'admin' then
    if (to_jsonb(new) - array['name', 'phone', 'role'])
       is distinct from
       (to_jsonb(old) - array['name', 'phone', 'role']) then
      raise exception 'department managers cannot change profile identity, tenant, or department'
        using errcode = '42501';
    end if;

    if new.role is null or new.role not in ('manager', 'user') then
      raise exception 'department managers cannot assign this role'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'profile mutation is outside the authenticated user tenant scope'
    using errcode = '42501';
end;
$function$;

revoke all on function public.guard_profile_privileged_fields() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_privileged_fields on public.profiles;
create trigger trg_guard_profile_privileged_fields
before insert or update on public.profiles
for each row execute function public.guard_profile_privileged_fields();

-- This check intentionally has no service-role bypass. Server actions must not
-- be able to write a department name that does not belong to the profile tenant.
create or replace function public.validate_profile_department_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.organization_id is null and new.department is not null then
    raise exception 'a profile department requires an organization'
      using errcode = '23514';
  end if;

  if new.organization_id is not null
     and new.department is not null
     and not exists (
       select 1
       from public.departments as d
       where d.organization_id = new.organization_id
         and d.name = new.department
     ) then
    raise exception 'profile department does not exist in the organization'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_profile_department_membership()
from public, anon, authenticated;

drop trigger if exists trg_validate_profile_department_membership on public.profiles;
create trigger trg_validate_profile_department_membership
before insert or update on public.profiles
for each row execute function public.validate_profile_department_membership();

-- profiles.id cascades from auth.users, so this trigger also protects Auth API
-- deletion. The organization-row lock serializes concurrent admin removals.
create or replace function public.prevent_last_organization_admin_loss()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.organization_id is null or old.role is distinct from 'admin' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role = 'admin'
       and new.organization_id is not distinct from old.organization_id then
      return new;
    end if;
  end if;

  perform 1
  from public.organizations as o
  where o.id = old.organization_id
  for update;

  -- Permit cleanup only if the referenced organization has already gone away.
  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles as remaining_admin
    where remaining_admin.organization_id = old.organization_id
      and remaining_admin.role = 'admin'
      and remaining_admin.id <> old.id
  ) then
    raise exception 'an organization must retain at least one admin'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function public.prevent_last_organization_admin_loss()
from public, anon, authenticated;

drop trigger if exists trg_prevent_last_organization_admin_delete on public.profiles;
create trigger trg_prevent_last_organization_admin_delete
before delete on public.profiles
for each row execute function public.prevent_last_organization_admin_loss();

drop trigger if exists trg_prevent_last_organization_admin_update on public.profiles;
create trigger trg_prevent_last_organization_admin_update
before update of role, organization_id on public.profiles
for each row execute function public.prevent_last_organization_admin_loss();

create or replace function public.set_profile_privilege_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'INSERT' then
    new.privilege_version := 0;
  elsif new.organization_id is distinct from old.organization_id
        or new.department is distinct from old.department
        or new.role is distinct from old.role then
    new.privilege_version := old.privilege_version + 1;
  else
    new.privilege_version := old.privilege_version;
  end if;

  return new;
end;
$function$;

revoke all on function public.set_profile_privilege_version()
from public, anon, authenticated;

-- Trigger names are executed alphabetically. This runs after the authorization,
-- last-admin, and department validation guards have accepted the row.
drop trigger if exists trg_zz_set_profile_privilege_version on public.profiles;
create trigger trg_zz_set_profile_privilege_version
before insert or update on public.profiles
for each row execute function public.set_profile_privilege_version();

do $profile_preflight$
begin
  if exists (
    select 1
    from public.organizations as o
    where exists (
      select 1 from public.profiles as member where member.organization_id = o.id
    )
      and not exists (
        select 1
        from public.profiles as admin_profile
        where admin_profile.organization_id = o.id
          and admin_profile.role = 'admin'
      )
  ) then
    raise exception 'an existing organization with members has no admin';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where (p.organization_id is null and p.department is not null)
       or (
         p.organization_id is not null
         and p.department is not null
         and not exists (
           select 1
           from public.departments as d
           where d.organization_id = p.organization_id
             and d.name = p.department
         )
       )
  ) then
    raise exception 'an existing profile references an invalid organization department';
  end if;
end;
$profile_preflight$;

-- ---------------------------------------------------------------------------
-- 3. Invitations: no anonymous table reads and no mutable privilege payload
-- ---------------------------------------------------------------------------

alter table public.organization_invites enable row level security;

drop policy if exists "organization_invites_select_own" on public.organization_invites;
drop policy if exists "organization_invites_select_by_token_anon" on public.organization_invites;
drop policy if exists "organization_invites_select_by_token_authenticated" on public.organization_invites;
drop policy if exists "organization_invites_insert_same_org" on public.organization_invites;
drop policy if exists "organization_invites_update_accept" on public.organization_invites;
drop policy if exists "organization_invites_update_same_org" on public.organization_invites;

-- RLS cannot prove that a SELECT included `token = ...`. Public invite lookup
-- therefore stays in getInviteByToken(), which validates on the server with a
-- service-role client. There is intentionally no SELECT policy for anon.
-- Organization admins manage every invite in their tenant; department
-- managers only manage manager/user invites in their own non-null department.
revoke select, insert, update, delete on table public.organization_invites from public, anon;
grant select, insert, update on table public.organization_invites to authenticated;

create policy "organization_invites_select_own"
on public.organization_invites
for select
to authenticated
using (
  (
    email is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
  )
  or public.is_user_admin_for_org(organization_id)
  or (
    role in ('manager', 'user')
    and public.is_user_manager_for_department(organization_id, department)
  )
);

create policy "organization_invites_insert_same_org"
on public.organization_invites
for insert
to authenticated
with check (
  role in ('admin', 'manager', 'user')
  and (
    public.is_user_admin_for_org(organization_id)
    or (
      role in ('manager', 'user')
      and public.is_user_manager_for_department(organization_id, department)
    )
  )
);

create policy "organization_invites_update_accept"
on public.organization_invites
for update
to authenticated
using (
  email is not null
  and nullif(trim(auth.jwt() ->> 'email'), '') is not null
  and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
)
with check (
  email is not null
  and nullif(trim(auth.jwt() ->> 'email'), '') is not null
  and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
);

create policy "organization_invites_update_same_org"
on public.organization_invites
for update
to authenticated
using (
  public.is_user_admin_for_org(organization_id)
  or (
    role in ('manager', 'user')
    and public.is_user_manager_for_department(organization_id, department)
  )
)
with check (
  public.is_user_admin_for_org(organization_id)
  or (
    role in ('manager', 'user')
    and public.is_user_manager_for_department(organization_id, department)
  )
);

create or replace function public.guard_organization_invite_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  jwt_email text := nullif(trim(auth.jwt() ->> 'email'), '');
begin
  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'invitation mutation requires an authenticated user'
      using errcode = '42501';
  end if;

  -- Invitees, organization admins, and department-scoped managers may only
  -- transition acceptance or revocation timestamps. Identity is immutable.
  if (to_jsonb(new) - array['accepted_at', 'revoked_at'])
     is distinct from
     (to_jsonb(old) - array['accepted_at', 'revoked_at']) then
    raise exception 'invitation identity and privilege fields are immutable'
      using errcode = '42501';
  end if;

  if old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at then
    raise exception 'an accepted invitation cannot be reopened'
      using errcode = '42501';
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'a revoked invitation cannot be reopened'
      using errcode = '42501';
  end if;

  if public.is_user_admin_for_org(old.organization_id) then
    return new;
  end if;

  if old.role in ('manager', 'user')
     and public.is_user_manager_for_department(
       old.organization_id,
       old.department
     ) then
    return new;
  end if;

  if old.email is not null
     and jwt_email is not null
     and lower(trim(old.email)) = lower(jwt_email) then
    return new;
  end if;

  raise exception 'invitation mutation is outside the authenticated user scope'
    using errcode = '42501';
end;
$function$;

revoke all on function public.guard_organization_invite_fields() from public, anon, authenticated;

drop trigger if exists trg_guard_organization_invite_fields on public.organization_invites;
create trigger trg_guard_organization_invite_fields
before update on public.organization_invites
for each row execute function public.guard_organization_invite_fields();

-- The old helper did not accept a token and consequently made every
-- organization with any active invite visible. Server-side token lookup is the
-- replacement, so the helper and its policy are removed.
drop policy if exists "organizations_select_by_invite_token" on public.organizations;
drop function if exists public.has_valid_invite_for_org(uuid);

-- ---------------------------------------------------------------------------
-- 4. Remove cross-tenant admin access and direct organization creation/deletion
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;

drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organizations_select_all_by_admin" on public.organizations;
drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "organizations_delete_admin" on public.organizations;

-- Steward Flow is invite-only. Organization creation and deletion must go
-- through service-role operator paths guarded by the platform allowlist.
revoke insert, delete on table public.organizations from public, anon, authenticated;

create policy "organizations_update_admin"
on public.organizations
for update
to authenticated
using (public.is_user_admin_for_org(id))
with check (public.is_user_admin_for_org(id));

-- Account-deletion requests keep durable, non-FK identity snapshots because
-- profiles are deleted by the Auth cascade before approval can be finalized.
alter table public.account_deletion_requests
  add column if not exists requester_user_id_snapshot uuid,
  add column if not exists transfer_user_id_snapshot uuid,
  add column if not exists approval_operation_id uuid,
  add column if not exists approval_actor_id_snapshot uuid,
  add column if not exists approval_started_at timestamp with time zone,
  add column if not exists transfer_previous_role text,
  add column if not exists transfer_expected_privilege_version bigint,
  add column if not exists transfer_applied boolean not null default false;

update public.account_deletion_requests
set requester_user_id_snapshot = requester_id
where requester_user_id_snapshot is null
  and requester_id is not null;

update public.account_deletion_requests
set transfer_user_id_snapshot = transfer_to_user_id
where transfer_user_id_snapshot is null
  and transfer_to_user_id is not null;

update public.account_deletion_requests
set transfer_applied = false
where transfer_applied is null;

alter table public.account_deletion_requests
  alter column requester_user_id_snapshot set not null,
  alter column requester_id drop not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column transfer_applied set default false,
  alter column transfer_applied set not null;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (
    status in (
      'pending',
      'processing',
      'approved',
      'rejected',
      'cancelled',
      'manual_review'
    )
  );

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_requester_id_fkey;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_transfer_to_user_id_fkey;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_resolved_by_fkey;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_requester_id_fkey
  foreign key (requester_id)
  references public.profiles(id)
  on delete set null;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_transfer_to_user_id_fkey
  foreign key (transfer_to_user_id)
  references public.profiles(id)
  on delete set null;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_resolved_by_fkey
  foreign key (resolved_by)
  references public.profiles(id)
  on delete set null;

create unique index if not exists idx_account_deletion_requests_approval_operation
on public.account_deletion_requests(approval_operation_id)
where approval_operation_id is not null;

create unique index if not exists idx_account_deletion_requests_one_active_requester
on public.account_deletion_requests(requester_user_id_snapshot)
where status in ('pending', 'processing', 'manual_review');

create or replace function public.guard_account_deletion_request_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if new.requester_id is null then
      raise exception 'an account deletion request requires a requester'
        using errcode = '23514';
    end if;

    new.requester_user_id_snapshot := new.requester_id;
    new.transfer_user_id_snapshot := new.transfer_to_user_id;
    new.approval_operation_id := null;
    new.approval_actor_id_snapshot := null;
    new.approval_started_at := null;
    new.transfer_previous_role := null;
    new.transfer_expected_privilege_version := null;
    new.transfer_applied := false;
    return new;
  end if;

  if new.requester_user_id_snapshot is distinct from old.requester_user_id_snapshot
     or new.transfer_user_id_snapshot is distinct from old.transfer_user_id_snapshot then
    raise exception 'account deletion identity snapshots are immutable'
      using errcode = '23514';
  end if;

  -- Permit only the nulling performed by profile foreign-key actions. Durable
  -- identity is retained in the immutable snapshot columns above.
  if (
       new.requester_id is not distinct from old.requester_id
       or (old.requester_id is not null and new.requester_id is null)
     )
     and (
       new.transfer_to_user_id is not distinct from old.transfer_to_user_id
       or (old.transfer_to_user_id is not null and new.transfer_to_user_id is null)
     )
     and (
       new.resolved_by is not distinct from old.resolved_by
       or (old.resolved_by is not null and new.resolved_by is null)
     )
     and (
       new.requester_id is distinct from old.requester_id
       or new.transfer_to_user_id is distinct from old.transfer_to_user_id
       or new.resolved_by is distinct from old.resolved_by
     )
     and (to_jsonb(new) - array['requester_id', 'transfer_to_user_id', 'resolved_by'])
       is not distinct from
       (to_jsonb(old) - array['requester_id', 'transfer_to_user_id', 'resolved_by']) then
    return new;
  end if;

  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if actor_id = old.requester_id
     and old.status = 'pending'
     and new.status = 'cancelled'
     and (to_jsonb(new) - 'status') is not distinct from (to_jsonb(old) - 'status') then
    return new;
  end if;

  raise exception 'account deletion requests must use the controlled server workflow'
    using errcode = '42501';
end;
$function$;

revoke all on function public.guard_account_deletion_request_fields()
from public, anon, authenticated;

drop trigger if exists trg_guard_account_deletion_request_fields
on public.account_deletion_requests;
create trigger trg_guard_account_deletion_request_fields
before insert or update on public.account_deletion_requests
for each row execute function public.guard_account_deletion_request_fields();

-- A manager cannot be deleted through the generic Auth admin path. The
-- processing request is the durable authorization consumed by the Auth
-- cascade after the successor promotion has committed.
create or replace function public.prevent_unapproved_manager_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  authorized_request_id uuid;
  authorized_successor_id uuid;
begin
  if old.role is distinct from 'manager' then
    return old;
  end if;

  select request.id, request.transfer_user_id_snapshot
    into authorized_request_id, authorized_successor_id
  from public.account_deletion_requests as request
  where request.requester_id = old.id
    and request.requester_user_id_snapshot = old.id
    and request.organization_id = old.organization_id
    and request.requester_role = 'manager'
    and request.requester_department is not distinct from old.department
    and request.status = 'processing'
    and request.approval_operation_id is not null
    and request.transfer_user_id_snapshot is not null
    and request.transfer_applied
  limit 1;

  perform 1
  from public.profiles as successor
  where successor.id = authorized_successor_id
  for update;

  if found then
    perform 1
    from public.account_deletion_requests as request
    where request.id = authorized_request_id
      and request.requester_id = old.id
      and request.requester_user_id_snapshot = old.id
      and request.organization_id = old.organization_id
      and request.requester_role = 'manager'
      and request.requester_department is not distinct from old.department
      and request.status = 'processing'
      and request.approval_operation_id is not null
      and request.transfer_to_user_id = authorized_successor_id
      and request.transfer_user_id_snapshot = authorized_successor_id
      and request.transfer_applied
      and exists (
        select 1
        from public.profiles as successor
        where successor.id = authorized_successor_id
          and successor.organization_id = request.organization_id
          and successor.department is not distinct from request.requester_department
          and successor.role = 'manager'
          and successor.privilege_version
            is not distinct from request.transfer_expected_privilege_version
      )
    for update;
  end if;

  if found then
    return old;
  end if;

  raise exception 'manager deletion requires a claimed account deletion request'
    using errcode = '42501';
end;
$function$;

revoke all on function public.prevent_unapproved_manager_profile_delete()
from public, anon, authenticated;

drop trigger if exists trg_prevent_unapproved_manager_profile_delete
on public.profiles;
create trigger trg_prevent_unapproved_manager_profile_delete
before delete on public.profiles
for each row execute function public.prevent_unapproved_manager_profile_delete();

-- Account-deletion reads and submission are tenant-local. Admin state changes
-- intentionally have no authenticated UPDATE policy and use service-only RPCs.
drop policy if exists "account_deletion_requests_select_admin" on public.account_deletion_requests;
drop policy if exists "account_deletion_requests_insert_own" on public.account_deletion_requests;
drop policy if exists "account_deletion_requests_update_admin" on public.account_deletion_requests;
drop policy if exists "account_deletion_requests_update_own" on public.account_deletion_requests;

create policy "account_deletion_requests_select_admin"
on public.account_deletion_requests
for select
to authenticated
using (public.is_user_admin_for_org(organization_id));

create policy "account_deletion_requests_insert_own"
on public.account_deletion_requests
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and organization_id = public.get_user_organization_id()
  and requester_user_id_snapshot = auth.uid()
  and status = 'pending'
  and requester_role = 'manager'
  and requester_department is not null
  and transfer_to_user_id is not null
  and transfer_user_id_snapshot = transfer_to_user_id
  and transfer_to_user_id <> requester_id
  and resolved_at is null
  and resolved_by is null
  and admin_note is null
  and approval_operation_id is null
  and approval_actor_id_snapshot is null
  and approval_started_at is null
  and transfer_previous_role is null
  and transfer_expected_privilege_version is null
  and not transfer_applied
  and exists (
    select 1
    from public.profiles as requester
    where requester.id = auth.uid()
      and requester.organization_id = public.account_deletion_requests.organization_id
      and requester.role = 'manager'
      and requester.department = public.account_deletion_requests.requester_department
  )
  and exists (
    select 1
    from public.profiles as transfer_target
    where transfer_target.id = public.account_deletion_requests.transfer_to_user_id
      and transfer_target.organization_id = public.account_deletion_requests.organization_id
      and transfer_target.department = public.account_deletion_requests.requester_department
      and transfer_target.role = 'user'
  )
);

create policy "account_deletion_requests_update_own"
on public.account_deletion_requests
for update
to authenticated
using (
  requester_id = auth.uid()
  and organization_id = public.get_user_organization_id()
  and status = 'pending'
)
with check (
  requester_id = auth.uid()
  and organization_id = public.get_user_organization_id()
  and status = 'cancelled'
);

drop function if exists public.claim_account_deletion_request_for_approval(
  uuid,
  uuid,
  uuid,
  text
);
create function public.claim_account_deletion_request_for_approval(
  target_request_id uuid,
  target_actor_id uuid,
  target_operation_id uuid,
  target_admin_note text default null
)
returns table (
  result_request_id uuid,
  result_requester_id uuid,
  result_organization_id uuid,
  result_transfer_to_user_id uuid,
  result_operation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  request_row public.account_deletion_requests%rowtype;
  actor_row public.profiles%rowtype;
  requester_row public.profiles%rowtype;
  transfer_row public.profiles%rowtype;
  expected_organization_id uuid;
  expected_requester_id uuid;
  expected_transfer_id uuid;
  observed_status text;
  observed_actor_id uuid;
  affected_rows integer;
  applied_transfer_privilege_version bigint;
  normalized_admin_note text;
  resume_auth_user_exists boolean;
  resume_actor_is_valid boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'account deletion approval requires the service role'
      using errcode = '42501';
  end if;

  if target_request_id is null
     or target_actor_id is null
     or target_operation_id is null then
    raise exception 'request, actor, and operation ids are required'
      using errcode = '22023';
  end if;

  normalized_admin_note := nullif(btrim(target_admin_note), '');
  if length(normalized_admin_note) > 2000 then
    raise exception 'admin note is too long'
      using errcode = '22023';
  end if;

  select
    request.organization_id,
    request.requester_user_id_snapshot,
    request.transfer_user_id_snapshot,
    request.status,
    request.approval_actor_id_snapshot
  into
    expected_organization_id,
    expected_requester_id,
    expected_transfer_id,
    observed_status,
    observed_actor_id
  from public.account_deletion_requests as request
  where request.id = target_request_id;

  if not found then
    raise exception 'account deletion request was not found'
      using errcode = 'P0002';
  end if;

  -- A repeated server action may resume the operation that the same actor
  -- already claimed, including after an Auth API timeout.
  if observed_status = 'processing' and observed_actor_id = target_actor_id then
    select actor.*
      into actor_row
    from public.profiles as actor
    where actor.id = target_actor_id
    for update;

    select requester.*
      into requester_row
    from public.profiles as requester
    where requester.id = expected_requester_id
    for update;

    select transfer_target.*
      into transfer_row
    from public.profiles as transfer_target
    where transfer_target.id = expected_transfer_id
    for update;

    select request.*
      into request_row
    from public.account_deletion_requests as request
    where request.id = target_request_id
    for update;

    if request_row.status <> 'processing'
       or request_row.approval_actor_id_snapshot <> target_actor_id
       or request_row.approval_operation_id is null
       or request_row.requester_user_id_snapshot is null
       or request_row.transfer_user_id_snapshot is null
       or not request_row.transfer_applied then
      raise exception 'account deletion request cannot resume this approval'
        using errcode = '55000';
    end if;

    resume_auth_user_exists := exists (
      select 1
      from auth.users as auth_user
      where auth_user.id = request_row.requester_user_id_snapshot
    );
    resume_actor_is_valid := coalesce((
      actor_row.id is not null
      and actor_row.role = 'admin'
      and actor_row.organization_id = request_row.organization_id
    ), false);

    if (
         requester_row.id is not null
         and (
           not resume_auth_user_exists
           or not resume_actor_is_valid
           or request_row.requester_id is distinct from request_row.requester_user_id_snapshot
           or requester_row.organization_id <> request_row.organization_id
           or requester_row.role <> 'manager'
           or requester_row.department is distinct from request_row.requester_department
         )
       )
       or (
         requester_row.id is null
         and (resume_auth_user_exists or request_row.requester_id is not null)
       )
       or transfer_row.id is null
       or transfer_row.organization_id <> request_row.organization_id
       or transfer_row.department is distinct from request_row.requester_department
       or transfer_row.role <> 'manager'
       or transfer_row.privilege_version
          is distinct from request_row.transfer_expected_privilege_version then
      update public.account_deletion_requests as request
      set
        status = 'manual_review',
        resolved_at = null
      where request.id = request_row.id
        and request.status = 'processing'
        and request.approval_actor_id_snapshot = target_actor_id
        and request.approval_operation_id = request_row.approval_operation_id;

      get diagnostics affected_rows = row_count;
      if affected_rows <> 1 then
        raise exception 'manual-review transition lost its compare-and-set race'
          using errcode = '40001';
      end if;

      insert into public.audit_logs (
        organization_id,
        actor_id,
        action,
        target_type,
        target_id,
        metadata
      ) values (
        request_row.organization_id,
        null,
        'account_deletion_manual_review_required',
        'account_deletion_request',
        request_row.id,
        pg_catalog.jsonb_build_object(
          'operation_id', request_row.approval_operation_id,
          'actor_id', target_actor_id,
          'requester_id', request_row.requester_user_id_snapshot,
          'requester_profile_exists', requester_row.id is not null,
          'requester_auth_exists', resume_auth_user_exists,
          'actor_still_authorized', resume_actor_is_valid,
          'expected_transfer_privilege_version',
            request_row.transfer_expected_privilege_version,
          'current_transfer_privilege_version', transfer_row.privilege_version
        )
      );

      return;
    end if;

    return query
    select
      request_row.id,
      request_row.requester_user_id_snapshot,
      request_row.organization_id,
      request_row.transfer_user_id_snapshot,
      request_row.approval_operation_id;
    return;
  end if;

  if observed_status <> 'pending'
     or expected_requester_id is null
     or expected_transfer_id is null then
    raise exception 'account deletion request is not pending'
      using errcode = '55000';
  end if;

  -- Lock order matches profile admin demotion: actor profile, organization,
  -- then the remaining profiles in stable UUID order, and finally the request.
  select actor.*
    into actor_row
  from public.profiles as actor
  where actor.id = target_actor_id
  for update;

  if not found
     or actor_row.role <> 'admin'
     or actor_row.organization_id is null
     or actor_row.organization_id <> expected_organization_id then
    raise exception 'actor is not an admin for this organization'
      using errcode = '42501';
  end if;

  perform 1
  from public.organizations as organization
  where organization.id = expected_organization_id
  for update;

  if not found then
    raise exception 'request organization was not found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.profiles as locked_profile
  where locked_profile.id = any(array[expected_requester_id, expected_transfer_id])
  order by locked_profile.id
  for update;

  select request.*
    into request_row
  from public.account_deletion_requests as request
  where request.id = target_request_id
  for update;

  if not found
     or request_row.status <> 'pending'
     or request_row.organization_id <> expected_organization_id
     or request_row.requester_id is distinct from expected_requester_id
     or request_row.requester_user_id_snapshot <> expected_requester_id
     or request_row.transfer_to_user_id is distinct from expected_transfer_id
     or request_row.transfer_user_id_snapshot <> expected_transfer_id
     or (
       request_row.approval_operation_id is not null
       and request_row.transfer_applied
     ) then
    raise exception 'account deletion request changed while it was being claimed'
      using errcode = '40001';
  end if;

  select requester.*
    into requester_row
  from public.profiles as requester
  where requester.id = expected_requester_id;

  if not found
     or requester_row.organization_id <> request_row.organization_id
     or requester_row.role <> 'manager'
     or requester_row.department is null
     or request_row.requester_role <> 'manager'
     or request_row.requester_department is distinct from requester_row.department then
    raise exception 'requester is no longer the snapshotted department manager'
      using errcode = '55000';
  end if;

  select transfer_target.*
    into transfer_row
  from public.profiles as transfer_target
  where transfer_target.id = expected_transfer_id;

  if not found
     or transfer_row.id = requester_row.id
     or transfer_row.organization_id <> request_row.organization_id
     or transfer_row.department is distinct from requester_row.department
     or transfer_row.role <> 'user' then
    raise exception 'transfer target is not an eligible user in the requester department'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.account_deletion_requests as target_request
    where target_request.requester_user_id_snapshot = transfer_row.id
      and target_request.id <> request_row.id
      and target_request.status in ('pending', 'processing', 'manual_review')
  ) then
    raise exception 'transfer target has an active account deletion request'
      using errcode = '55000';
  end if;

  update public.account_deletion_requests as request
  set
    status = 'processing',
    resolved_at = null,
    resolved_by = target_actor_id,
    admin_note = normalized_admin_note,
    approval_operation_id = target_operation_id,
    approval_actor_id_snapshot = target_actor_id,
    approval_started_at = clock_timestamp(),
    transfer_previous_role = transfer_row.role,
    transfer_expected_privilege_version = transfer_row.privilege_version + 1,
    transfer_applied = true
  where request.id = request_row.id
    and request.status = 'pending'
    and request.requester_id = expected_requester_id
    and request.transfer_to_user_id = expected_transfer_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'account deletion request claim lost its compare-and-set race'
      using errcode = '40001';
  end if;

  update public.profiles as transfer_target
  set role = 'manager'
  where transfer_target.id = expected_transfer_id
    and transfer_target.organization_id = request_row.organization_id
    and transfer_target.department is not distinct from requester_row.department
    and transfer_target.role = 'user'
    and transfer_target.privilege_version = transfer_row.privilege_version
  returning transfer_target.privilege_version
    into applied_transfer_privilege_version;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1
     or applied_transfer_privilege_version <> transfer_row.privilege_version + 1 then
    raise exception 'transfer target promotion lost its compare-and-set race'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    request_row.organization_id,
    target_actor_id,
    'account_deletion_approval_started',
    'account_deletion_request',
    request_row.id,
    pg_catalog.jsonb_build_object(
      'operation_id', target_operation_id,
      'requester_id', expected_requester_id,
      'transfer_to_user_id', expected_transfer_id
    )
  ), (
    request_row.organization_id,
    target_actor_id,
    'role_transferred',
    'profile',
    expected_transfer_id,
    pg_catalog.jsonb_build_object(
      'operation_id', target_operation_id,
      'from_user_id', expected_requester_id,
      'to_user_id', expected_transfer_id,
      'from_role', transfer_row.role,
      'to_role', 'manager'
    )
  );

  return query
  select
    request_row.id,
    expected_requester_id,
    request_row.organization_id,
    expected_transfer_id,
    target_operation_id;
end;
$function$;

revoke all on function public.claim_account_deletion_request_for_approval(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.claim_account_deletion_request_for_approval(
  uuid,
  uuid,
  uuid,
  text
) to service_role;

drop function if exists public.rollback_account_deletion_request_approval(
  uuid,
  uuid,
  uuid
);
create function public.rollback_account_deletion_request_approval(
  target_request_id uuid,
  target_actor_id uuid,
  target_operation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  request_row public.account_deletion_requests%rowtype;
  requester_row public.profiles%rowtype;
  transfer_row public.profiles%rowtype;
  expected_requester_id uuid;
  expected_transfer_id uuid;
  expected_organization_id uuid;
  affected_rows integer;
  requester_is_valid boolean;
  transfer_is_rollback_safe boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'account deletion rollback requires the service role'
      using errcode = '42501';
  end if;

  if target_request_id is null
     or target_actor_id is null
     or target_operation_id is null then
    raise exception 'request, actor, and operation ids are required'
      using errcode = '22023';
  end if;

  select
    request.requester_user_id_snapshot,
    request.transfer_user_id_snapshot,
    request.organization_id
  into expected_requester_id, expected_transfer_id, expected_organization_id
  from public.account_deletion_requests as request
  where request.id = target_request_id;

  if not found or expected_requester_id is null or expected_transfer_id is null then
    raise exception 'account deletion request cannot be rolled back'
      using errcode = 'P0002';
  end if;

  -- Match the Auth-delete trigger lock order: requester, successor, request.
  select requester.*
    into requester_row
  from public.profiles as requester
  where requester.id = expected_requester_id
  for update;

  select transfer_target.*
    into transfer_row
  from public.profiles as transfer_target
  where transfer_target.id = expected_transfer_id
  for update;

  select request.*
    into request_row
  from public.account_deletion_requests as request
  where request.id = target_request_id
  for update;

  if not found
     or request_row.organization_id <> expected_organization_id
     or request_row.requester_user_id_snapshot <> expected_requester_id
     or request_row.transfer_user_id_snapshot <> expected_transfer_id
     or request_row.approval_actor_id_snapshot <> target_actor_id
     or request_row.approval_operation_id <> target_operation_id then
    raise exception 'account deletion rollback operation does not match the claim'
      using errcode = '55000';
  end if;

  requester_is_valid := coalesce((exists (
    select 1 from auth.users as auth_user where auth_user.id = expected_requester_id
  )
    and requester_row.id is not null
    and requester_row.organization_id = request_row.organization_id
    and requester_row.role = 'manager'
    and requester_row.department is not distinct from request_row.requester_department), false);

  transfer_is_rollback_safe := coalesce((request_row.transfer_applied
    and request_row.requester_id is not distinct from expected_requester_id
    and request_row.transfer_to_user_id is not distinct from expected_transfer_id
    and request_row.transfer_previous_role = 'user'
    and transfer_row.id is not null
    and transfer_row.organization_id = request_row.organization_id
    and transfer_row.department is not distinct from request_row.requester_department
    and transfer_row.role = 'manager'
    and transfer_row.privilege_version
      is not distinct from request_row.transfer_expected_privilege_version), false);

  if request_row.status = 'processing'
     and (not requester_is_valid or not transfer_is_rollback_safe) then
    update public.account_deletion_requests as request
    set
      status = 'manual_review',
      resolved_at = null
    where request.id = request_row.id
      and request.status = 'processing'
      and request.approval_actor_id_snapshot = target_actor_id
      and request.approval_operation_id = target_operation_id;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'manual-review transition lost its compare-and-set race'
        using errcode = '40001';
    end if;

    insert into public.audit_logs (
      organization_id,
      actor_id,
      action,
      target_type,
      target_id,
      metadata
    ) values (
      request_row.organization_id,
      null,
      'account_deletion_manual_review_required',
      'account_deletion_request',
      request_row.id,
      pg_catalog.jsonb_build_object(
        'operation_id', target_operation_id,
        'actor_id', target_actor_id,
        'requester_id', expected_requester_id,
        'requester_state_valid', requester_is_valid,
        'transfer_state_valid', transfer_is_rollback_safe,
        'expected_transfer_privilege_version',
          request_row.transfer_expected_privilege_version,
        'current_transfer_privilege_version', transfer_row.privilege_version
      )
    );

    return false;
  end if;

  if not requester_is_valid then
    raise exception 'requester no longer exists in the claimed manager state'
      using errcode = '55000';
  end if;

  if request_row.status = 'pending'
     and not request_row.transfer_applied
     and transfer_row.id is not null
     and transfer_row.organization_id = request_row.organization_id
     and transfer_row.department is not distinct from request_row.requester_department
     and transfer_row.role = 'user' then
    return true;
  end if;

  if request_row.status <> 'processing' or not transfer_is_rollback_safe then
    raise exception 'approval state changed; automatic rollback is unsafe'
      using errcode = '55000';
  end if;

  update public.profiles as transfer_target
  set role = 'user'
  where transfer_target.id = expected_transfer_id
    and transfer_target.organization_id = request_row.organization_id
    and transfer_target.department is not distinct from request_row.requester_department
    and transfer_target.role = 'manager'
    and transfer_target.privilege_version = request_row.transfer_expected_privilege_version;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'transfer rollback lost its compare-and-set race'
      using errcode = '40001';
  end if;

  update public.account_deletion_requests as request
  set
    status = 'pending',
    resolved_at = null,
    resolved_by = null,
    admin_note = null,
    approval_started_at = null,
    transfer_previous_role = null,
    transfer_expected_privilege_version = null,
    transfer_applied = false
  where request.id = request_row.id
    and request.status = 'processing'
    and request.approval_actor_id_snapshot = target_actor_id
    and request.approval_operation_id = target_operation_id
    and request.transfer_applied;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'request rollback lost its compare-and-set race'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    request_row.organization_id,
    null,
    'account_deletion_approval_rolled_back',
    'account_deletion_request',
    request_row.id,
    pg_catalog.jsonb_build_object(
      'operation_id', target_operation_id,
      'actor_id', target_actor_id,
      'requester_id', expected_requester_id,
      'transfer_to_user_id', expected_transfer_id
    )
  );

  return true;
end;
$function$;

revoke all on function public.rollback_account_deletion_request_approval(
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.rollback_account_deletion_request_approval(
  uuid,
  uuid,
  uuid
) to service_role;

drop function if exists public.finalize_account_deletion_request_approval(
  uuid,
  uuid,
  uuid
);
create function public.finalize_account_deletion_request_approval(
  target_request_id uuid,
  target_actor_id uuid,
  target_operation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  request_row public.account_deletion_requests%rowtype;
  transfer_row public.profiles%rowtype;
  expected_transfer_id uuid;
  expected_status text;
  expected_actor_id uuid;
  expected_operation_id uuid;
  affected_rows integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'account deletion finalization requires the service role'
      using errcode = '42501';
  end if;

  if target_request_id is null
     or target_actor_id is null
     or target_operation_id is null then
    raise exception 'request, actor, and operation ids are required'
      using errcode = '22023';
  end if;

  select
    request.status,
    request.approval_actor_id_snapshot,
    request.approval_operation_id,
    request.transfer_user_id_snapshot
  into expected_status, expected_actor_id, expected_operation_id, expected_transfer_id
  from public.account_deletion_requests as request
  where request.id = target_request_id;

  if not found then
    raise exception 'account deletion request was not found'
      using errcode = 'P0002';
  end if;

  if expected_status = 'approved'
     and expected_actor_id = target_actor_id
     and expected_operation_id = target_operation_id then
    select request.*
      into request_row
    from public.account_deletion_requests as request
    where request.id = target_request_id
    for update;

    if request_row.status = 'approved'
       and request_row.approval_actor_id_snapshot = target_actor_id
       and request_row.approval_operation_id = target_operation_id then
      return true;
    end if;
  end if;

  if expected_status <> 'processing'
     or expected_actor_id <> target_actor_id
     or expected_operation_id <> target_operation_id
     or expected_transfer_id is null then
    raise exception 'account deletion request is not in this processing operation'
      using errcode = '55000';
  end if;

  -- Lock the transfer profile before the request so a concurrent FK nulling
  -- action cannot deadlock finalization.
  select transfer_target.*
    into transfer_row
  from public.profiles as transfer_target
  where transfer_target.id = expected_transfer_id
  for update;

  select request.*
    into request_row
  from public.account_deletion_requests as request
  where request.id = target_request_id
  for update;

  if not found
     or request_row.status <> 'processing'
     or request_row.approval_actor_id_snapshot <> target_actor_id
     or request_row.approval_operation_id <> target_operation_id
     or request_row.transfer_user_id_snapshot <> expected_transfer_id
     or request_row.requester_id is not null then
    raise exception 'account deletion request changed before finalization'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = request_row.requester_user_id_snapshot
  )
     or exists (
       select 1
       from public.profiles as requester
       where requester.id = request_row.requester_user_id_snapshot
     ) then
    raise exception 'requester still exists and cannot be finalized as deleted'
      using errcode = '55000';
  end if;

  if request_row.transfer_to_user_id is distinct from expected_transfer_id
     or not request_row.transfer_applied
     or request_row.transfer_previous_role <> 'user'
     or transfer_row.id is null
     or transfer_row.organization_id <> request_row.organization_id
     or transfer_row.department is distinct from request_row.requester_department
     or transfer_row.role <> 'manager'
     or transfer_row.privilege_version
        is distinct from request_row.transfer_expected_privilege_version then
    update public.account_deletion_requests as request
    set
      status = 'manual_review',
      resolved_at = null
    where request.id = request_row.id
      and request.status = 'processing'
      and request.approval_actor_id_snapshot = target_actor_id
      and request.approval_operation_id = target_operation_id;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'manual-review transition lost its compare-and-set race'
        using errcode = '40001';
    end if;

    insert into public.audit_logs (
      organization_id,
      actor_id,
      action,
      target_type,
      target_id,
      metadata
    ) values (
      request_row.organization_id,
      null,
      'account_deletion_manual_review_required',
      'account_deletion_request',
      request_row.id,
      pg_catalog.jsonb_build_object(
        'operation_id', target_operation_id,
        'actor_id', target_actor_id,
        'requester_id', request_row.requester_user_id_snapshot,
        'auth_user_deleted', true,
        'expected_transfer_privilege_version',
          request_row.transfer_expected_privilege_version,
        'current_transfer_privilege_version', transfer_row.privilege_version
      )
    );

    return false;
  end if;

  update public.account_deletion_requests as request
  set
    status = 'approved',
    resolved_at = clock_timestamp()
  where request.id = request_row.id
    and request.status = 'processing'
    and request.approval_actor_id_snapshot = target_actor_id
    and request.approval_operation_id = target_operation_id
    and request.transfer_applied;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'account deletion finalization lost its compare-and-set race'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    request_row.organization_id,
    null,
    'account_deleted',
    'profile',
    request_row.requester_user_id_snapshot,
    pg_catalog.jsonb_build_object(
      'operation_id', target_operation_id,
      'actor_id', target_actor_id,
      'deleted_user_name', request_row.requester_name,
      'deleted_user_email', request_row.requester_email,
      'requester_department', request_row.requester_department,
      'transfer_to_user_id', request_row.transfer_user_id_snapshot
    )
  );

  return true;
end;
$function$;

revoke all on function public.finalize_account_deletion_request_approval(
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.finalize_account_deletion_request_approval(
  uuid,
  uuid,
  uuid
) to service_role;

drop function if exists public.reject_account_deletion_request(uuid, uuid, text);
create function public.reject_account_deletion_request(
  target_request_id uuid,
  target_actor_id uuid,
  target_admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  request_row public.account_deletion_requests%rowtype;
  actor_row public.profiles%rowtype;
  requester_row public.profiles%rowtype;
  transfer_row public.profiles%rowtype;
  expected_organization_id uuid;
  expected_requester_id uuid;
  expected_transfer_id uuid;
  affected_rows integer;
  normalized_admin_note text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'account deletion rejection requires the service role'
      using errcode = '42501';
  end if;

  if target_request_id is null or target_actor_id is null then
    raise exception 'request and actor ids are required'
      using errcode = '22023';
  end if;

  normalized_admin_note := nullif(btrim(target_admin_note), '');
  if length(normalized_admin_note) > 2000 then
    raise exception 'admin note is too long'
      using errcode = '22023';
  end if;

  select
    request.organization_id,
    request.requester_user_id_snapshot,
    request.transfer_user_id_snapshot
  into expected_organization_id, expected_requester_id, expected_transfer_id
  from public.account_deletion_requests as request
  where request.id = target_request_id
    and request.status = 'pending';

  if not found or expected_requester_id is null or expected_transfer_id is null then
    raise exception 'pending account deletion request was not found'
      using errcode = 'P0002';
  end if;

  select actor.*
    into actor_row
  from public.profiles as actor
  where actor.id = target_actor_id
  for update;

  if not found
     or actor_row.role <> 'admin'
     or actor_row.organization_id is null
     or actor_row.organization_id <> expected_organization_id then
    raise exception 'actor is not an admin for this organization'
      using errcode = '42501';
  end if;

  perform 1
  from public.organizations as organization
  where organization.id = expected_organization_id
  for update;

  if not found then
    raise exception 'request organization was not found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.profiles as locked_profile
  where locked_profile.id = any(array[expected_requester_id, expected_transfer_id])
  order by locked_profile.id
  for update;

  select request.*
    into request_row
  from public.account_deletion_requests as request
  where request.id = target_request_id
  for update;

  if not found
     or request_row.status <> 'pending'
     or request_row.organization_id <> expected_organization_id
     or request_row.requester_id is distinct from expected_requester_id
     or request_row.requester_user_id_snapshot <> expected_requester_id
     or request_row.transfer_to_user_id is distinct from expected_transfer_id
     or request_row.transfer_user_id_snapshot <> expected_transfer_id
     or request_row.transfer_applied then
    raise exception 'account deletion request changed while it was being rejected'
      using errcode = '40001';
  end if;

  select requester.*
    into requester_row
  from public.profiles as requester
  where requester.id = expected_requester_id;

  if not found
     or requester_row.organization_id <> request_row.organization_id
     or requester_row.role <> 'manager'
     or requester_row.department is null
     or request_row.requester_role <> 'manager'
     or request_row.requester_department is distinct from requester_row.department then
    raise exception 'requester is no longer the snapshotted department manager'
      using errcode = '55000';
  end if;

  select transfer_target.*
    into transfer_row
  from public.profiles as transfer_target
  where transfer_target.id = expected_transfer_id;

  if not found
     or transfer_row.id = requester_row.id
     or transfer_row.organization_id <> request_row.organization_id
     or transfer_row.department is distinct from requester_row.department
     or transfer_row.role <> 'user' then
    raise exception 'transfer target is not an eligible user in the requester department'
      using errcode = '55000';
  end if;

  update public.account_deletion_requests as request
  set
    status = 'rejected',
    resolved_at = clock_timestamp(),
    resolved_by = target_actor_id,
    admin_note = normalized_admin_note,
    approval_operation_id = null,
    approval_actor_id_snapshot = null,
    approval_started_at = null,
    transfer_previous_role = null,
    transfer_applied = false
  where request.id = request_row.id
    and request.status = 'pending'
    and request.requester_id = expected_requester_id
    and request.transfer_to_user_id = expected_transfer_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'account deletion rejection lost its compare-and-set race'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    request_row.organization_id,
    target_actor_id,
    'account_deletion_rejected',
    'account_deletion_request',
    request_row.id,
    pg_catalog.jsonb_build_object(
      'requester_id', expected_requester_id,
      'transfer_to_user_id', expected_transfer_id,
      'admin_note', normalized_admin_note
    )
  );

  return true;
end;
$function$;

revoke all on function public.reject_account_deletion_request(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.reject_account_deletion_request(uuid, uuid, text)
to service_role;

-- The same-organization feedback policies already exist; remove only the
-- cross-tenant variants.
drop policy if exists "feedbacks_select_all_by_admin" on public.feedbacks;
drop policy if exists "feedbacks_update_all_by_admin" on public.feedbacks;

-- ---------------------------------------------------------------------------
-- 5. Atomically cancel a borrower's still-requested book loan
-- ---------------------------------------------------------------------------

create or replace function public.cancel_requested_book_loan_atomic(
  target_loan_id uuid,
  target_borrower_id uuid
)
returns table (
  result_loan_id uuid,
  result_book_item_id uuid,
  result_organization_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  cancelled_loan_id uuid;
  cancelled_book_item_id uuid;
  cancelled_organization_id uuid;
begin
  if target_loan_id is null or target_borrower_id is null then
    raise exception 'loan id and borrower id are required'
      using errcode = '22023';
  end if;

  if auth.role() = 'service_role' then
    null;
  elsif auth.role() = 'authenticated'
        and auth.uid() = target_borrower_id then
    null;
  else
    raise exception 'a borrower can only cancel their own requested book loan'
      using errcode = '42501';
  end if;

  update public.book_loans as bl
  set status = 'cancelled'
  where bl.id = target_loan_id
    and bl.borrower_id = target_borrower_id
    and bl.status = 'requested'
  returning bl.id, bl.book_item_id, bl.organization_id
    into cancelled_loan_id, cancelled_book_item_id, cancelled_organization_id;

  if not found then
    raise exception 'requested book loan was not found or was already processed'
      using errcode = 'P0002';
  end if;

  -- Serialize status reconciliation for this item with other item updates.
  perform 1
  from public.book_items as bi
  where bi.id = cancelled_book_item_id
  for update;

  update public.book_items as bi
  set status = 'available'
  where bi.id = cancelled_book_item_id
    and bi.organization_id = cancelled_organization_id
    and bi.status = 'requested'
    and not exists (
      select 1
      from public.book_loans as active_loan
      where active_loan.book_item_id = cancelled_book_item_id
        and active_loan.status in ('requested', 'approved', 'borrowed', 'overdue')
    );

  return query
  select
    cancelled_loan_id,
    cancelled_book_item_id,
    cancelled_organization_id;
end;
$function$;

revoke all on function public.cancel_requested_book_loan_atomic(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.cancel_requested_book_loan_atomic(uuid, uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Migration-time assertions and operator verification
-- ---------------------------------------------------------------------------

do $verification$
declare
  relation_name text;
  function_signature text;
  foreign_key_name text;
begin
  foreach relation_name in array array[
    'profiles',
    'organization_invites',
    'organizations',
    'account_deletion_requests'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = relation_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS must be enabled on public.%', relation_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'organization_invites'
      and (
        'anon' = any(roles)
        or 'public' = any(roles)
      )
  ) then
    raise exception 'anonymous or public organization_invites policy remains after hardening';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'organization_invites'
      and (
        coalesce(qual, '') like '%is_user_manager_or_admin_for_org%'
        or coalesce(with_check, '') like '%is_user_manager_or_admin_for_org%'
      )
  ) then
    raise exception 'an organization-wide manager invitation policy remains after hardening';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.organization_invites', 'SELECT') then
    raise exception 'anon still has organization_invites SELECT privilege';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.organizations', 'INSERT') then
    raise exception 'authenticated still has direct organizations INSERT privilege';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.organizations', 'DELETE') then
    raise exception 'authenticated still has direct organizations DELETE privilege';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname in (
        'profiles_select_all_by_admin',
        'profiles_select_pending_users_by_admin',
        'profiles_update_pending_users_by_admin',
        'organizations_select_all_by_admin',
        'organizations_insert_authenticated',
        'organizations_delete_admin',
        'account_deletion_requests_update_admin',
        'feedbacks_select_all_by_admin',
        'feedbacks_update_all_by_admin'
      )
  ) then
    raise exception 'a cross-tenant or open-creation policy remains after hardening';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'trg_guard_profile_privileged_fields'
      and not t.tgisinternal
  ) then
    raise exception 'profile privileged-field guard trigger was not installed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'trg_validate_profile_department_membership'
      and not t.tgisinternal
  ) then
    raise exception 'profile department membership trigger was not installed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'trg_prevent_last_organization_admin_delete'
      and not t.tgisinternal
  ) or not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'trg_prevent_last_organization_admin_update'
      and not t.tgisinternal
  ) then
    raise exception 'last organization admin guard triggers were not installed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'trg_zz_set_profile_privilege_version'
      and not t.tgisinternal
  ) then
    raise exception 'profile privilege revision trigger was not installed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.account_deletion_requests'::regclass
      and t.tgname = 'trg_guard_account_deletion_request_fields'
      and not t.tgisinternal
  ) then
    raise exception 'account deletion request field guard trigger was not installed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'trg_prevent_unapproved_manager_profile_delete'
      and not t.tgisinternal
  ) then
    raise exception 'manager deletion authorization trigger was not installed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.organization_invites'::regclass
      and t.tgname = 'trg_guard_organization_invite_fields'
      and not t.tgisinternal
  ) then
    raise exception 'invitation privileged-field guard trigger was not installed';
  end if;

  if to_regprocedure(
    'public.cancel_requested_book_loan_atomic(uuid,uuid)'
  ) is null then
    raise exception 'atomic requested-book-loan cancellation function was not installed';
  end if;

  if exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'account_deletion_requests'
      and column_info.column_name = 'requester_id'
      and column_info.is_nullable <> 'YES'
  ) then
    raise exception 'account deletion requester_id must be nullable';
  end if;

  if not exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'account_deletion_requests'
      and column_info.column_name = 'requester_user_id_snapshot'
      and column_info.is_nullable = 'NO'
  ) then
    raise exception 'durable account deletion requester snapshot was not installed';
  end if;

  if not exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'profiles'
      and column_info.column_name = 'privilege_version'
      and column_info.is_nullable = 'NO'
  ) then
    raise exception 'profile privilege revision column was not installed';
  end if;

  if exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'account_deletion_requests'
      and column_info.column_name = 'status'
      and column_info.is_nullable <> 'NO'
  ) then
    raise exception 'account deletion request status must be NOT NULL';
  end if;

  foreach foreign_key_name in array array[
    'account_deletion_requests_requester_id_fkey',
    'account_deletion_requests_transfer_to_user_id_fkey',
    'account_deletion_requests_resolved_by_fkey'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_constraint as constraint_info
      where constraint_info.conrelid = 'public.account_deletion_requests'::regclass
        and constraint_info.conname = foreign_key_name
        and constraint_info.contype = 'f'
        and constraint_info.confdeltype = 'n'
    ) then
      raise exception 'account deletion FK must use ON DELETE SET NULL: %', foreign_key_name;
    end if;
  end loop;

  foreach function_signature in array array[
    'public.claim_account_deletion_request_for_approval(uuid,uuid,uuid,text)',
    'public.rollback_account_deletion_request_approval(uuid,uuid,uuid)',
    'public.finalize_account_deletion_request_approval(uuid,uuid,uuid)',
    'public.reject_account_deletion_request(uuid,uuid,text)'
  ]
  loop
    if to_regprocedure(function_signature) is null then
      raise exception 'required account deletion function was not installed: %', function_signature;
    end if;

    if pg_catalog.has_function_privilege('authenticated', function_signature, 'EXECUTE') then
      raise exception 'authenticated can execute service-only function: %', function_signature;
    end if;

    if not pg_catalog.has_function_privilege('service_role', function_signature, 'EXECUTE') then
      raise exception 'service_role cannot execute required function: %', function_signature;
    end if;
  end loop;
end;
$verification$;

commit;

-- Read-only post-apply audit output. Expected results:
--   * no anon policy for organization_invites
--   * no *_all_by_admin policy
--   * profiles_update_* policies are tenant-bound; the trigger enforces fields
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'organization_invites',
    'organizations',
    'account_deletion_requests',
    'feedbacks'
  )
order by tablename, cmd, policyname;
