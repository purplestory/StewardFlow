-- account_deletion_requests 테이블 RLS 정책 수정 (재귀 문제 해결)

-- 0. 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
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

-- 인덱스 생성 (없으면)
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_org ON public.account_deletion_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_requester ON public.account_deletion_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON public.account_deletion_requests(status);

-- RLS 활성화
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "account_deletion_requests_select_own" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "account_deletion_requests_select_admin" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "account_deletion_requests_insert_own" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "account_deletion_requests_update_admin" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "account_deletion_requests_update_own" ON public.account_deletion_requests;

-- 2. 정책: 자신의 요청은 조회 가능
CREATE POLICY "account_deletion_requests_select_own"
ON public.account_deletion_requests
FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid()
);

-- 3. 정책: 최고 관리자는 모든 요청 조회 가능 (함수 사용으로 재귀 방지)
CREATE POLICY "account_deletion_requests_select_admin"
ON public.account_deletion_requests
FOR SELECT
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자(admin)인 경우 (함수 사용으로 재귀 방지)
  -- 최고 관리자는 모든 기관의 요청을 조회할 수 있음
  public.is_user_admin()
);

-- 4. 정책: 자신의 요청 생성 가능
CREATE POLICY "account_deletion_requests_insert_own"
ON public.account_deletion_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid()
);

-- 5. 정책: 최고 관리자는 승인/거부 가능 (함수 사용으로 재귀 방지)
CREATE POLICY "account_deletion_requests_update_admin"
ON public.account_deletion_requests
FOR UPDATE
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자(admin)인 경우 (함수 사용으로 재귀 방지)
  -- 최고 관리자는 모든 기관의 요청을 수정할 수 있음
  public.is_user_admin()
);

-- 6. 정책: 자신의 요청 취소 가능
CREATE POLICY "account_deletion_requests_update_own"
ON public.account_deletion_requests
FOR UPDATE
TO authenticated
USING (
  requester_id = auth.uid() AND status = 'pending'
)
WITH CHECK (
  requester_id = auth.uid() AND status = 'cancelled'
);

-- 7. 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'account_deletion_requests'
ORDER BY policyname, cmd;
