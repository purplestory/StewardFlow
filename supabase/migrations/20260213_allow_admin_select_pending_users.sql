-- 최고 관리자가 organization_id가 null인 미승인 사용자를 조회할 수 있도록 정책 추가
-- 이 정책은 가입 신청한 사용자를 관리자가 승인할 수 있도록 합니다.

-- 최고 관리자가 미승인 사용자(organization_id가 null)를 조회할 수 있도록 정책 추가
CREATE POLICY "profiles_select_pending_users_by_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자(admin)이고
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
  -- 조회하려는 사용자의 organization_id가 null인 경우 (미승인 사용자)
  AND organization_id IS NULL
);

-- 정책 확인 쿼리
-- 실행 후 이 쿼리로 정책이 제대로 생성되었는지 확인하세요
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
