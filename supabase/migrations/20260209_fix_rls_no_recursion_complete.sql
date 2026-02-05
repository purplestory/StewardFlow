-- 완전한 RLS 정책 수정 (재귀 완전 방지)
-- 이 마이그레이션은 모든 재귀 문제를 해결합니다.

-- ============================================
-- 1. profiles 테이블 RLS 정책 (가장 단순하게)
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 보조 함수 삭제 (재귀를 일으킬 수 있음)
DROP FUNCTION IF EXISTS public.get_user_organization_id();

-- 가장 단순한 정책: 본인 프로필만 조회 가능
-- 같은 기관의 프로필은 애플리케이션 레벨에서 organization_id를 사용하여 조회
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- ============================================
-- 2. user_role() 함수 수정 (재귀 방지)
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
-- 3. assets, spaces, vehicles RLS 정책 수정
-- ============================================

-- assets 정책 수정
DROP POLICY IF EXISTS "assets_select_same_org" ON public.assets;

CREATE POLICY "assets_select_same_org"
ON public.assets
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id IN (
    -- user_role() 함수를 사용하지 않고 직접 조회
    -- 하지만 이것도 재귀를 일으킬 수 있으므로,
    -- 애플리케이션 레벨에서 organization_id를 전달하는 것이 더 안전합니다.
    -- 일단 organization_id가 NULL이 아니면 허용 (임시)
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
      AND organization_id IS NOT NULL
  )
);

-- spaces 정책 수정
DROP POLICY IF EXISTS "spaces_select_same_org" ON public.spaces;

CREATE POLICY "spaces_select_same_org"
ON public.spaces
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
      AND organization_id IS NOT NULL
  )
);

-- vehicles 정책 수정
DROP POLICY IF EXISTS "vehicles_select_same_org" ON public.vehicles;

CREATE POLICY "vehicles_select_same_org"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
      AND organization_id IS NOT NULL
  )
);

-- ============================================
-- 4. 정책 확인
-- ============================================

SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'assets', 'spaces', 'vehicles')
ORDER BY tablename, policyname;

-- ============================================
-- 참고: 같은 기관의 프로필을 조회해야 하는 경우
-- ============================================
-- 애플리케이션 레벨에서:
-- 1. 먼저 본인 프로필을 조회하여 organization_id를 가져옵니다.
-- 2. 그 다음 같은 organization_id를 가진 프로필을 조회합니다.
-- 
-- 예시:
-- const { data: myProfile } = await supabase
--   .from("profiles")
--   .select("organization_id")
--   .eq("id", userId)
--   .single();
-- 
-- if (myProfile?.organization_id) {
--   const { data: orgProfiles } = await supabase
--     .from("profiles")
--     .select("*")
--     .eq("organization_id", myProfile.organization_id);
-- }
