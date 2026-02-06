-- 본인 프로필 조회를 보장하는 RLS 정책 수정
-- 기존 정책이 서브쿼리로 인해 문제가 발생할 수 있으므로, 본인 프로필 조회를 별도 정책으로 분리

-- 1. 기존 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'SELECT'
ORDER BY policyname;

-- 2. 기존 본인 프로필 조회 정책 삭제 (있다면)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

-- 3. 본인 프로필 조회 정책 추가 (서브쿼리 없이 단순하게)
-- 이 정책은 다른 정책보다 우선 적용되도록 먼저 체크됩니다
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 무조건 조회 가능 (서브쿼리 없이 단순하게)
  id = auth.uid()
);

-- 4. 같은 기관의 프로필 조회 정책 (기존 정책 유지하되, 본인 프로필은 제외)
-- 본인 프로필은 위의 정책에서 처리되므로 여기서는 제외
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필이 아니고
  id != auth.uid()
  -- 같은 기관의 프로필 조회 가능
  AND organization_id IS NOT NULL
  AND organization_id = (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- 5. 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'SELECT'
ORDER BY policyname;
