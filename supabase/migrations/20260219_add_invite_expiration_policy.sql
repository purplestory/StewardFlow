-- 기관별 초대 링크 만료일 정책 + 초대별 만료 시각 저장

alter table public.organizations
  add column if not exists invite_expires_days integer not null default 7;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_invite_expires_days_chk'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_invite_expires_days_chk
      check (invite_expires_days between 1 and 30);
  end if;
end
$$;

alter table public.organization_invites
  add column if not exists expires_at timestamp with time zone;

update public.organization_invites oi
set expires_at = oi.created_at + make_interval(days => coalesce(o.invite_expires_days, 7))
from public.organizations o
where oi.organization_id = o.id
  and oi.expires_at is null;

update public.organization_invites
set expires_at = created_at + interval '7 days'
where expires_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_invites'
      and column_name = 'expires_at'
      and is_nullable = 'YES'
  ) then
    alter table public.organization_invites
      alter column expires_at set not null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_invites_expires_after_created_chk'
      and conrelid = 'public.organization_invites'::regclass
  ) then
    alter table public.organization_invites
      add constraint organization_invites_expires_after_created_chk
      check (expires_at >= created_at);
  end if;
end
$$;

create index if not exists idx_organization_invites_pending_expires_at
  on public.organization_invites(expires_at)
  where accepted_at is null and revoked_at is null;

create or replace function public.set_organization_invite_expires_at()
returns trigger
language plpgsql
as $$
declare
  v_days integer := 7;
begin
  if new.expires_at is not null then
    return new;
  end if;

  if new.organization_id is not null then
    select coalesce(invite_expires_days, 7)
      into v_days
    from public.organizations
    where id = new.organization_id;
  end if;

  if v_days < 1 then
    v_days := 1;
  elsif v_days > 30 then
    v_days := 30;
  end if;

  new.expires_at := coalesce(new.created_at, now()) + make_interval(days => v_days);
  return new;
end;
$$;

drop trigger if exists trg_set_organization_invite_expires_at on public.organization_invites;
create trigger trg_set_organization_invite_expires_at
before insert on public.organization_invites
for each row execute function public.set_organization_invite_expires_at();
