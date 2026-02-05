-- 긴급: profiles RLS 정책 완전 재설정
-- 이 SQL을 Supabase SQL Editor에서 실행하세요.

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;

-- 2. RLS 일시적으로 비활성화 (확인용)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 3. 새 정책 생성 (가장 단순한 버전)
CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 본인 프로필은 무조건 조회 가능
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

-- 4. 정책 확인
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 5. 테스트: 특정 사용자로 직접 확인 (SQL Editor에서는 auth.uid()가 작동하지 않으므로 애플리케이션에서 확인)
-- 실제로는 브라우저에서 확인해야 함

-- 참고: 만약 위 방법이 안 되면, RLS를 완전히 비활성화하고 테스트
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- (테스트 후 다시 활성화: ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;)
