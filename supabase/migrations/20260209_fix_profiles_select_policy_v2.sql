-- Fix profiles SELECT policy (Version 2 - More robust)
-- 이 마이그레이션은 기존 정책을 완전히 재설정합니다.

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 2. RLS 활성화 확인 및 강제 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. 새 정책 생성 (가장 단순하고 확실한 버전)
-- 본인 프로필은 무조건 조회 가능
-- 같은 기관의 프로필도 조회 가능
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 무조건 조회 가능 (가장 먼저 체크)
  id = auth.uid()
  -- 또는 같은 기관의 프로필 조회 가능
  OR (
    organization_id IS NOT NULL
    AND organization_id = (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- 4. 정책 확인 쿼리
-- 실행 후 이 쿼리로 정책이 제대로 생성되었는지 확인하세요
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
