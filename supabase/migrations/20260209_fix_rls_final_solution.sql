-- 최종 해결책: 재귀 완전 방지
-- 이 마이그레이션은 모든 재귀 문제를 해결합니다.

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
-- 2. 같은 기관 프로필 조회 함수 생성
-- ============================================

-- 같은 기관의 프로필을 조회하는 함수 (SECURITY DEFINER로 RLS 우회)
CREATE OR REPLACE FUNCTION public.get_org_profiles()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  department text,
  role text,
  organization_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- 현재 사용자의 organization_id 가져오기 (RLS 우회)
  SELECT organization_id INTO user_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  -- 같은 기관의 프로필 반환 (RLS 우회)
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.name,
    p.department,
    p.role,
    p.organization_id
  FROM public.profiles p
  WHERE p.organization_id = user_org_id
  ORDER BY p.created_at ASC;
END;
$$;

-- ============================================
-- 3. profiles 테이블 RLS 정책 (본인 프로필만)
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 가장 단순한 정책: 본인 프로필만 조회 가능
-- 같은 기관의 프로필은 get_org_profiles() 함수를 사용하여 조회
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

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

-- ============================================
-- 참고: 같은 기관의 프로필을 조회하는 방법
-- ============================================
-- 현재 정책은 본인 프로필만 조회 가능합니다.
-- 같은 기관의 프로필을 조회하려면:
-- 
-- 1. 먼저 본인 프로필을 조회하여 organization_id를 가져옵니다.
-- 2. 그 다음 같은 organization_id를 가진 프로필을 조회합니다.
--    하지만 이 경우 RLS 정책 때문에 실패할 수 있습니다.
-- 
-- 해결책: 같은 기관의 프로필을 조회하는 별도의 함수를 만들거나,
-- 애플리케이션 레벨에서 organization_id를 사용하여 조회합니다.
-- 
-- 또는 아래와 같이 별도의 정책을 추가할 수 있습니다:
-- (하지만 이것도 재귀를 일으킬 수 있으므로 주의)
