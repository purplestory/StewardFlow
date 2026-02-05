-- 부서 변경 요청 테이블 생성
create table if not exists public.department_change_requests (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  requester_id uuid references public.profiles(id) not null,
  from_department text,
  to_department text not null,
  status text default 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone,
  resolved_by uuid references public.profiles(id)
);

-- 인덱스 생성
create index if not exists idx_department_change_requests_org 
on public.department_change_requests(organization_id);

create index if not exists idx_department_change_requests_requester 
on public.department_change_requests(requester_id);

create index if not exists idx_department_change_requests_status 
on public.department_change_requests(status);

-- RLS 활성화
alter table public.department_change_requests enable row level security;

-- 기존 정책 삭제 (이미 존재하는 경우)
drop policy if exists "department_change_requests_select_own" on public.department_change_requests;
drop policy if exists "department_change_requests_insert_same_org" on public.department_change_requests;
drop policy if exists "department_change_requests_update_same_org" on public.department_change_requests;

-- RLS 정책: 같은 기관의 사용자는 자신의 요청을 볼 수 있음
create policy "department_change_requests_select_own"
on public.department_change_requests
for select
using (
  auth.uid() = requester_id
  or (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = department_change_requests.organization_id
      and (
        profiles.role = 'admin'
        or (
          profiles.role = 'manager'
          and (
            -- 부서 관리자는 자신의 부서 사용자 요청을 볼 수 있음
            department_change_requests.from_department = profiles.department
            or department_change_requests.to_department = profiles.department
          )
        )
      )
    )
  )
);

-- RLS 정책: 같은 기관의 사용자는 요청을 생성할 수 있음
create policy "department_change_requests_insert_same_org"
on public.department_change_requests
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.organization_id = department_change_requests.organization_id
  )
);

-- RLS 정책: 관리자와 부서 관리자는 승인/거부할 수 있음
create policy "department_change_requests_update_same_org"
on public.department_change_requests
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.organization_id = department_change_requests.organization_id
    and (
      profiles.role = 'admin'
      or (
        profiles.role = 'manager'
        and (
          -- 부서 관리자는 자신의 부서 사용자 요청을 승인/거부할 수 있음
          department_change_requests.from_department = profiles.department
          or department_change_requests.to_department = profiles.department
        )
      )
    )
  )
  or auth.uid() = requester_id -- 요청자는 취소할 수 있음
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.organization_id = department_change_requests.organization_id
    and (
      profiles.role = 'admin'
      or (
        profiles.role = 'manager'
        and (
          department_change_requests.from_department = profiles.department
          or department_change_requests.to_department = profiles.department
        )
      )
    )
  )
  or auth.uid() = requester_id
);
