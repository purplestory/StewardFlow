-- 초대 테이블의 organization_id가 null인 경우 수정
-- 초대를 생성한 사용자의 organization_id를 찾아서 초대에 설정

-- 1. 먼저 확인: organization_id가 null인 초대 목록
SELECT 
  i.id,
  i.email,
  i.name,
  i.role,
  i.organization_id as invite_org_id,
  i.accepted_at,
  i.created_at,
  p.organization_id as creator_org_id
FROM public.organization_invites i
LEFT JOIN public.profiles p ON p.id = (
  -- 초대를 생성한 사용자를 찾기 (audit_logs에서 확인)
  SELECT actor_id 
  FROM public.audit_logs 
  WHERE action = 'invite_created' 
    AND target_type = 'invite'
    AND target_id::text = i.id::text
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE i.organization_id IS NULL
ORDER BY i.created_at DESC;

-- 2. 특정 초대의 organization_id 수정 (purplestory1945@gmail.com)
-- 먼저 이메일로 사용자를 찾아서 organization_id 확인
UPDATE public.organization_invites i
SET organization_id = (
  SELECT organization_id 
  FROM public.profiles 
  WHERE email = 'purplestory1945@gmail.com'
  LIMIT 1
)
WHERE i.email = 'purplestory1945@gmail.com'
  AND i.organization_id IS NULL;

-- 3. 또는 초대를 생성한 사용자의 organization_id로 업데이트 (audit_logs 기반)
UPDATE public.organization_invites i
SET organization_id = (
  SELECT p.organization_id
  FROM public.audit_logs al
  JOIN public.profiles p ON p.id = al.actor_id
  WHERE al.action = 'invite_created'
    AND al.target_type = 'invite'
    AND al.target_id::text = i.id::text
  ORDER BY al.created_at ASC
  LIMIT 1
)
WHERE i.organization_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.audit_logs al
    WHERE al.action = 'invite_created'
      AND al.target_type = 'invite'
      AND al.target_id::text = i.id::text
  );

-- 4. 또는 현재 활성 사용자들의 organization_id로 업데이트 (이메일 매칭)
UPDATE public.organization_invites i
SET organization_id = (
  SELECT organization_id 
  FROM public.profiles 
  WHERE email = i.email
    AND organization_id IS NOT NULL
  LIMIT 1
)
WHERE i.organization_id IS NULL
  AND i.email IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.email = i.email
      AND p.organization_id IS NOT NULL
  );

-- 5. 확인: 수정된 초대 목록
SELECT 
  id,
  email,
  name,
  role,
  organization_id,
  accepted_at,
  created_at
FROM public.organization_invites
WHERE email = 'purplestory1945@gmail.com'
ORDER BY created_at DESC;
