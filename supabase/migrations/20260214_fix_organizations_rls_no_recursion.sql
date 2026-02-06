-- organizations 테이블 RLS 정책 수정 (재귀 문제 해결)

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_by_invite_token" ON public.organizations;

-- 2. INSERT 정책: 모든 인증된 사용자가 기관 생성 가능
CREATE POLICY "organizations_insert_authenticated"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. SELECT 정책: 사용자는 자신이 속한 기관만 조회 가능 (함수 사용으로 재귀 방지)
CREATE POLICY "organizations_select_own"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  -- 자신이 속한 기관만 조회 가능 (함수 사용으로 재귀 방지)
  id = public.get_user_organization_id()
);

-- 4. 최고 관리자가 모든 기관 조회 가능 (함수 사용으로 재귀 방지)
CREATE POLICY "organizations_select_all_by_admin"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자(admin)인 경우 (함수 사용으로 재귀 방지)
  public.is_user_admin()
);

-- 5. UPDATE 정책: 관리자만 자신의 기관 수정 가능 (함수 사용으로 재귀 방지)
CREATE POLICY "organizations_update_admin"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  -- 자신이 속한 기관이고 관리자인 경우 (함수 사용으로 재귀 방지)
  id = public.get_user_organization_id()
  AND public.is_user_admin()
)
WITH CHECK (
  -- 업데이트 후에도 같은 기관이어야 함
  id = public.get_user_organization_id()
);

-- 6. DELETE 정책: 관리자만 자신의 기관 삭제 가능 (함수 사용으로 재귀 방지)
CREATE POLICY "organizations_delete_admin"
ON public.organizations
FOR DELETE
TO authenticated
USING (
  -- 자신이 속한 기관이고 관리자인 경우 (함수 사용으로 재귀 방지)
  id = public.get_user_organization_id()
  AND public.is_user_admin()
);

-- 7. 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY policyname, cmd;
