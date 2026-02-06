-- profiles_update_admin_same_org 정책을 is_user_admin() 함수를 사용하도록 수정
-- 재귀 문제 방지

-- 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_update_admin_same_org" ON public.profiles;

-- 최고 관리자가 같은 기관의 다른 사용자 프로필을 업데이트할 수 있도록 정책 재생성 (함수 사용)
CREATE POLICY "profiles_update_admin_same_org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자이고 (함수 사용으로 재귀 방지)
  public.is_user_admin()
  -- 업데이트하려는 사용자가 같은 기관에 속해 있는 경우 (organization_id가 null이 아닌 경우)
  AND organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
)
WITH CHECK (
  -- 현재 사용자가 최고 관리자인 경우 (함수 사용으로 재귀 방지)
  public.is_user_admin()
  -- 업데이트 후에도 같은 기관에 속해 있어야 함
  AND organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);
