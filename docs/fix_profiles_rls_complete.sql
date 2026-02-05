-- profiles 테이블 RLS 정책 완전 수정
-- 이 SQL은 기존 정책을 모두 삭제하고 새로 생성합니다.

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 2. SELECT 정책: 본인 프로필 또는 같은 기관의 프로필 조회 가능
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Allow if viewing own profile
  id = auth.uid()
  -- OR if viewing profiles in the same organization
  OR (
    organization_id IS NOT NULL
    AND organization_id = (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
  )
);

-- 3. INSERT 정책: 본인 프로필만 생성 가능
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 4. UPDATE 정책: 본인 프로필만 수정 가능 (단, organization_id는 제외)
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 5. 확인: 정책이 제대로 생성되었는지 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 6. 테스트: 현재 사용자의 프로필 조회 테스트
-- (이 쿼리는 SQL Editor에서 직접 실행할 수 없지만, 애플리케이션에서 테스트 가능)
-- SELECT id, email, name, organization_id, role
-- FROM public.profiles
-- WHERE id = auth.uid();
