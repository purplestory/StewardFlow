-- Fix profiles RLS policy to avoid infinite recursion
-- 무한 재귀를 피하기 위해 profiles 정책을 수정합니다.

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

-- 새 정책 생성 (재귀 없음)
-- 본인 프로필은 항상 조회 가능
-- 같은 기관의 프로필도 조회 가능 (보조 함수 사용)
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

-- 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
