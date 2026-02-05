-- 최종 해결책: 재귀 완전 방지 + 같은 기관 프로필 조회 가능
-- 이 마이그레이션은 모든 문제를 해결합니다.

-- ============================================
-- 1. 보조 함수 생성 (SECURITY DEFINER로 RLS 우회)
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS public.get_user_organization_id();

-- 새 함수: SECURITY DEFINER로 RLS를 완전히 우회
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- RLS를 우회하여 직접 조회
  SELECT organization_id INTO org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN org_id;
END;
$$;

-- ============================================
-- 2. profiles 테이블 RLS 정책 (재귀 방지)
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 새 정책: 본인 프로필은 항상 조회 가능
-- 같은 기관의 프로필도 조회 가능 (보조 함수 사용으로 재귀 방지)
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 무조건 조회 가능
  id = auth.uid()
  -- 또는 같은 기관의 프로필 조회 가능 (보조 함수 사용으로 재귀 방지)
  OR (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
  )
);

-- ============================================
-- 3. user_role() 함수 수정 (SECURITY DEFINER 사용)
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS public.user_role();

-- 새 함수: SECURITY DEFINER로 RLS 우회
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- RLS를 우회하여 직접 조회
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$;

-- ============================================
-- 4. assets, spaces, vehicles RLS 정책 수정
-- ============================================

-- assets 정책 수정 (보조 함수 사용)
DROP POLICY IF EXISTS "assets_select_same_org" ON public.assets;

CREATE POLICY "assets_select_same_org"
ON public.assets
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- spaces 정책 수정 (보조 함수 사용)
DROP POLICY IF EXISTS "spaces_select_same_org" ON public.spaces;

CREATE POLICY "spaces_select_same_org"
ON public.spaces
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- vehicles 정책 수정 (보조 함수 사용)
DROP POLICY IF EXISTS "vehicles_select_same_org" ON public.vehicles;

CREATE POLICY "vehicles_select_same_org"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
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
