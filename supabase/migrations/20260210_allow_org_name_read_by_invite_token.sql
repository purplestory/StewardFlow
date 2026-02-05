-- 초대 토큰으로 기관 이름 조회 허용
-- 초대 링크를 열 때 아직 해당 조직에 속하지 않은 사용자도 기관 이름을 볼 수 있도록 함

-- 함수: 유효한 초대 토큰이 있는지 확인 (초대 토큰의 organization_id와 일치하는지 확인)
CREATE OR REPLACE FUNCTION public.has_valid_invite_for_org(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_invites
    WHERE organization_id = org_id
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND created_at > NOW() - INTERVAL '7 days'
    LIMIT 1
  );
$$;

-- organizations 테이블에 초대 토큰으로 조회 가능한 정책 추가
-- 유효한 초대 토큰이 있는 경우 기관 이름 조회 허용
-- 기존 정책과 함께 사용 (OR 조건)
CREATE POLICY IF NOT EXISTS "organizations_select_by_invite_token"
ON public.organizations
FOR SELECT
TO authenticated, anon
USING (
  -- 유효한 초대 토큰이 있는 경우 허용
  public.has_valid_invite_for_org(id)
);
