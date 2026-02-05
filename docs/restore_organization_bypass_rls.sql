-- 기관 정보 복구 (RLS 우회 버전)
-- Supabase SQL Editor에서 실행하면 RLS 정책을 우회할 수 있습니다.

-- 1. 현재 상황 확인
SELECT 
  p.id,
  p.email,
  p.name,
  p.organization_id,
  p.role,
  o.name as organization_name
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.organization_id
WHERE p.email IN ('smartffy@kakao.com', 'nankej77@naver.com')
ORDER BY p.created_at DESC;

-- 2. 기관 목록 확인
SELECT 
  id,
  name,
  created_at
FROM public.organizations
ORDER BY created_at DESC;

-- 3. RLS를 일시적으로 비활성화하고 업데이트 (주의: 실행 후 다시 활성화 필요)
-- 방법 1: 직접 프로필 ID로 업데이트 (가장 확실한 방법)
-- 먼저 프로필 ID를 확인
SELECT id, email, name, organization_id
FROM public.profiles
WHERE email = 'smartffy@kakao.com';

-- 프로필 ID를 확인한 후 아래 쿼리에서 ID를 교체하여 실행
-- UPDATE public.profiles
-- SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
-- WHERE id = '프로필_ID_여기에_입력';

-- 방법 2: 이메일로 직접 업데이트 (RLS 우회)
-- Supabase SQL Editor는 service_role로 실행되므로 RLS를 우회할 수 있습니다.
UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
WHERE email = 'smartffy@kakao.com'
  AND (organization_id IS NULL OR organization_id != '05efc956-4b5b-4dec-8d1c-2689e93086c5');

-- 4. 확인
SELECT 
  id,
  email,
  name,
  organization_id,
  role,
  department
FROM public.profiles
WHERE email = 'smartffy@kakao.com';

-- 5. 모든 NULL 프로필 복구 (필요한 경우)
UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
WHERE organization_id IS NULL
  AND email IN ('smartffy@kakao.com', 'nankej77@naver.com');
