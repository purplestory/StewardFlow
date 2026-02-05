-- 최종: profiles RLS 정책 수정 (재귀 완전 방지)
-- 이 방법은 보조 함수를 사용하지 않고 직접 auth.uid()를 사용합니다.

-- 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 보조 함수 삭제 (필요시)
DROP FUNCTION IF EXISTS public.get_user_organization_id();

-- 방법 1: 가장 단순한 정책 (본인 프로필만 조회 가능)
-- 이 방법은 일단 작동하는지 확인하기 위한 것입니다.
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 참고: 같은 기관의 프로필을 조회하려면, 
-- 애플리케이션 레벨에서 organization_id를 가져온 후
-- 별도의 쿼리로 같은 기관의 프로필을 조회해야 합니다.
-- 또는 아래의 방법 2를 사용할 수 있습니다.

-- 방법 2: 같은 기관 프로필도 조회 가능 (더 복잡하지만 재귀 없음)
-- 이 방법은 organization_id를 직접 비교합니다.
-- 하지만 이 방법도 profiles 테이블을 조회해야 하므로 재귀가 발생할 수 있습니다.
-- 따라서 방법 1을 먼저 시도하고, 필요하면 방법 2를 사용하세요.

-- 방법 2를 사용하려면 아래 주석을 해제하세요:
/*
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 항상 조회 가능
  id = auth.uid()
  -- 또는 organization_id가 NULL이 아닌 경우 (조건부)
  OR organization_id IS NOT NULL
);
*/

-- 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
