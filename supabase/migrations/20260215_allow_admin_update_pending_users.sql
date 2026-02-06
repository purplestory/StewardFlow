-- 최고 관리자가 미승인 사용자(organization_id가 null)의 프로필을 업데이트할 수 있도록 정책 추가
-- is_user_admin() 함수를 사용하여 재귀 문제 방지

-- 최고 관리자가 미승인 사용자 프로필을 업데이트할 수 있도록 정책 추가
CREATE POLICY "profiles_update_pending_users_by_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자이고 (함수 사용으로 재귀 방지)
  public.is_user_admin()
  -- 업데이트하려는 사용자의 organization_id가 null인 경우 (미승인 사용자)
  AND organization_id IS NULL
)
WITH CHECK (
  -- 현재 사용자가 최고 관리자인 경우 (함수 사용으로 재귀 방지)
  public.is_user_admin()
  -- 업데이트 후에는 organization_id가 설정되어야 함 (null이 아니어야 함)
  AND organization_id IS NOT NULL
  -- 업데이트 후 organization_id는 현재 관리자의 organization_id와 같아야 함
  AND organization_id = public.get_user_organization_id()
);
