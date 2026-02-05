-- 완전한 RLS 정책 수정 (단계별 실행)

-- ============================================
-- 1단계: 기존 정책 확인 및 삭제
-- ============================================

-- 현재 정책 확인
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

-- 기존 정책 모두 삭제
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

-- ============================================
-- 2단계: RLS 활성화 확인
-- ============================================

-- RLS가 활성화되어 있는지 확인
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- RLS가 비활성화되어 있다면 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3단계: 새 정책 생성 (가장 단순한 버전)
-- ============================================

-- SELECT 정책: 본인 프로필은 항상 조회 가능, 같은 기관 프로필도 조회 가능
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

-- INSERT 정책: 본인 프로필만 생성 가능
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- UPDATE 정책: 본인 프로필만 수정 가능
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- DELETE 정책: 본인 프로필만 삭제 가능 (일반적으로는 사용하지 않음)
CREATE POLICY "profiles_delete_own"
ON public.profiles
FOR DELETE
TO authenticated
USING (id = auth.uid());

-- ============================================
-- 4단계: 정책 확인
-- ============================================

SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- 5단계: 테스트 (SQL Editor에서는 auth.uid()가 작동하지 않으므로 애플리케이션에서 확인)
-- ============================================

-- 참고: 실제 테스트는 브라우저 콘솔에서 수행해야 함
-- 브라우저 콘솔에서 다음 코드 실행:
/*
const { data: session } = await supabase.auth.getSession();
console.log("User ID:", session.session?.user?.id);

const { data: profile, error } = await supabase
  .from("profiles")
  .select("id, email, name, organization_id, role")
  .eq("id", session.session?.user?.id)
  .maybeSingle();

console.log("Profile:", profile);
console.log("Error:", error);
*/

-- ============================================
-- 6단계: 문제 해결 (위 방법이 안 되면)
-- ============================================

-- 옵션 A: RLS를 완전히 비활성화 (임시 테스트용)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- (테스트 후 다시 활성화: ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;)

-- 옵션 B: 모든 authenticated 사용자가 모든 프로필 조회 가능 (보안 위험, 개발 환경에서만)
-- DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;
-- CREATE POLICY "profiles_select_all"
-- ON public.profiles
-- FOR SELECT
-- TO authenticated
-- USING (true);
