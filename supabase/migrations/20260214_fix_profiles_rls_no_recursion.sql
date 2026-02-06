-- profiles RLS 정책 무한 재귀 문제 완전 해결
-- 모든 정책을 제거하고 가장 단순한 정책만 남김

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_pending_users_by_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_by_admin" ON public.profiles;

-- 2. 함수는 다른 정책들(assets, spaces, vehicles 등)에서 사용 중이므로 삭제하지 않음

-- 2-1. 최고 관리자 확인 함수 생성 (SECURITY DEFINER로 RLS 우회)
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- SECURITY DEFINER로 실행되므로 RLS가 자동으로 우회됨
  -- SET LOCAL을 사용하지 않고 직접 조회
  SELECT role INTO user_role
  FROM public.profiles 
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role = 'admin';
END;
$$;

-- 3. 본인 프로필 조회 정책 (가장 기본, 재귀 없음)
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 무조건 조회 가능
  id = auth.uid()
);

-- 4. 같은 기관의 프로필 조회 정책 (get_user_organization_id 함수 사용)
-- 이 함수는 이미 다른 테이블에서 사용 중이며 SECURITY DEFINER로 설정되어 있어 재귀 문제 없음
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필이 아니고
  id != auth.uid()
  -- organization_id가 있고
  AND organization_id IS NOT NULL
  -- 같은 기관의 프로필 조회 가능 (함수 사용으로 RLS 재귀 방지)
  AND organization_id = public.get_user_organization_id()
);

-- 5. 최고 관리자가 모든 사용자 조회 정책 (함수 사용으로 재귀 방지)
-- 최고 관리자는 모든 기관의 사용자와 미승인 사용자를 조회할 수 있음
CREATE POLICY "profiles_select_all_by_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자(admin)인 경우 (함수 사용으로 재귀 방지)
  public.is_user_admin()
  -- 모든 프로필 조회 가능 (본인 프로필, 같은 기관, 다른 기관, 미승인 사용자 모두)
);

-- 6. 최고 관리자가 미승인 사용자 조회 정책 (함수 사용으로 재귀 방지)
CREATE POLICY "profiles_select_pending_users_by_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자(admin)이고 (함수 사용으로 재귀 방지)
  public.is_user_admin()
  -- organization_id가 null인 프로필 조회 가능 (미승인 사용자)
  AND organization_id IS NULL
);

-- 6. 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'SELECT'
ORDER BY policyname;
