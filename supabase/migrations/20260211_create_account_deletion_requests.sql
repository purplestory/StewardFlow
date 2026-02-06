-- 계정 탈퇴 요청 테이블 생성
create table if not exists public.account_deletion_requests (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) not null,
  requester_id uuid references public.profiles(id) not null,
  requester_name text,
  requester_email text,
  requester_role text,
  requester_department text,
  transfer_to_user_id uuid references public.profiles(id),
  transfer_to_user_name text,
  status text default 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  note text,
  admin_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone,
  resolved_by uuid references public.profiles(id)
);

-- 인덱스 생성
create index if not exists idx_account_deletion_requests_org on public.account_deletion_requests(organization_id);
create index if not exists idx_account_deletion_requests_requester on public.account_deletion_requests(requester_id);
create index if not exists idx_account_deletion_requests_status on public.account_deletion_requests(status);

-- RLS 활성화
alter table public.account_deletion_requests enable row level security;

-- 정책: 자신의 요청은 조회 가능
create policy "account_deletion_requests_select_own"
on public.account_deletion_requests
for select
to authenticated
using (
  requester_id = auth.uid()
);

-- 정책: 최고 관리자는 모든 요청 조회 가능
create policy "account_deletion_requests_select_admin"
on public.account_deletion_requests
for select
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles 
    where id = auth.uid() and role = 'admin'
  )
);

-- 정책: 자신의 요청 생성 가능
create policy "account_deletion_requests_insert_own"
on public.account_deletion_requests
for insert
to authenticated
with check (
  requester_id = auth.uid()
);

-- 정책: 최고 관리자는 승인/거부 가능
create policy "account_deletion_requests_update_admin"
on public.account_deletion_requests
for update
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles 
    where id = auth.uid() and role = 'admin'
  )
);

-- 정책: 자신의 요청 취소 가능
create policy "account_deletion_requests_update_own"
on public.account_deletion_requests
for update
to authenticated
using (
  requester_id = auth.uid() and status = 'pending'
)
with check (
  requester_id = auth.uid() and status = 'cancelled'
);
