-- 즉시 실행: profiles RLS 정책 수정
-- 이 SQL을 Supabase SQL Editor에서 실행하세요.

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 2. 새 정책 생성: 본인 프로필은 항상 조회 가능, 같은 기관 프로필도 조회 가능
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 항상 조회 가능 (가장 먼저 체크)
  id = auth.uid()
  -- 또는 같은 기관의 프로필 조회 가능
  OR (
    organization_id IS NOT NULL
    AND organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
        AND organization_id IS NOT NULL
    )
  )
);

-- 3. 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 4. 테스트: 특정 사용자로 테스트 (SQL Editor에서는 직접 테스트 불가, 애플리케이션에서 확인)
-- 실제로는 애플리케이션에서 로그인한 사용자의 프로필이 조회되는지 확인
