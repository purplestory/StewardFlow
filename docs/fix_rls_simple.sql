-- 간단한 RLS 정책 수정 (즉시 실행)
-- Supabase SQL Editor에서 실행하세요.

-- 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 새 정책 생성
-- 본인 프로필은 항상 조회 가능 (가장 중요!)
-- 같은 기관의 프로필도 조회 가능
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 항상 조회 가능 (이것이 가장 먼저 체크되어야 함)
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

-- 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
