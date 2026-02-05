-- 모든 RLS 정책 수정 (profiles, assets, spaces, vehicles)
-- 이 마이그레이션은 모든 테이블의 RLS 정책을 재설정합니다.

-- ============================================
-- 1. profiles 테이블 RLS 정책 수정 (재귀 방지)
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 보조 함수 생성 (재귀를 피하기 위해)
-- 이 함수는 security definer로 실행되어 RLS를 우회합니다.
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- 새 정책 생성: 본인 프로필은 무조건 조회 가능, 같은 기관 프로필도 조회 가능
-- 보조 함수를 사용하여 재귀를 방지합니다.
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 무조건 조회 가능 (가장 먼저 체크)
  id = auth.uid()
  -- 또는 같은 기관의 프로필 조회 가능 (보조 함수 사용으로 재귀 방지)
  OR (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
  )
);

-- ============================================
-- 2. assets 테이블 RLS 정책 확인 및 수정
-- ============================================

-- 기존 정책 확인
SELECT policyname FROM pg_policies WHERE tablename = 'assets';

-- assets SELECT 정책 재생성 (더 안전한 버전)
DROP POLICY IF EXISTS "assets_select_same_org" ON public.assets;

CREATE POLICY "assets_select_same_org"
ON public.assets
FOR SELECT
TO authenticated
USING (
  -- organization_id가 NULL이 아니고, 사용자의 organization_id와 일치하는 경우
  -- 보조 함수를 사용하여 재귀를 방지합니다.
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- ============================================
-- 3. spaces 테이블 RLS 정책 확인 및 수정
-- ============================================

-- 기존 정책 확인
SELECT policyname FROM pg_policies WHERE tablename = 'spaces';

-- spaces SELECT 정책 재생성
DROP POLICY IF EXISTS "spaces_select_same_org" ON public.spaces;

CREATE POLICY "spaces_select_same_org"
ON public.spaces
FOR SELECT
TO authenticated
USING (
  -- organization_id가 NULL이 아니고, 사용자의 organization_id와 일치하는 경우
  -- 보조 함수를 사용하여 재귀를 방지합니다.
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- ============================================
-- 4. vehicles 테이블 RLS 정책 확인 및 수정
-- ============================================

-- 기존 정책 확인
SELECT policyname FROM pg_policies WHERE tablename = 'vehicles';

-- vehicles SELECT 정책 재생성
DROP POLICY IF EXISTS "vehicles_select_same_org" ON public.vehicles;

CREATE POLICY "vehicles_select_same_org"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  -- organization_id가 NULL이 아니고, 사용자의 organization_id와 일치하는 경우
  -- 보조 함수를 사용하여 재귀를 방지합니다.
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- ============================================
-- 5. 정책 확인
-- ============================================

SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'assets', 'spaces', 'vehicles')
ORDER BY tablename, policyname;
