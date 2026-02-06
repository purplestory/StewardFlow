-- profiles_select_same_org 정책의 서브쿼리 재귀 문제 해결
-- 서브쿼리 대신 함수를 사용하여 RLS 재귀 문제를 방지

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 2. 같은 기관의 organization_id를 반환하는 함수 생성 (SECURITY DEFINER로 RLS 완전 우회)
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result uuid;
BEGIN
  -- RLS를 완전히 우회하여 조회
  SET LOCAL row_security = off;
  SELECT organization_id INTO result
  FROM public.profiles 
  WHERE id = auth.uid()
  LIMIT 1;
  RETURN result;
END;
$$;

-- 3. 같은 기관의 프로필 조회 정책 재생성 (함수 사용)
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필이 아니고
  id != auth.uid()
  -- 같은 기관의 프로필 조회 가능 (함수 사용으로 RLS 재귀 방지)
  AND organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- 4. 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'SELECT'
ORDER BY policyname;
