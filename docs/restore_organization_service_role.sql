-- 기관 정보 복구 (Service Role 사용 - RLS 완전 우회)
-- 이 방법은 Supabase Dashboard의 SQL Editor에서 실행하면 자동으로 service_role을 사용합니다.

-- 1단계: 현재 상황 확인
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

-- 2단계: 기관 ID 확인
SELECT 
  id,
  name,
  created_at
FROM public.organizations
WHERE id = '05efc956-4b5b-4dec-8d1c-2689e93086c5';

-- 3단계: 프로필 업데이트 (RLS 우회)
-- Supabase SQL Editor는 service_role로 실행되므로 RLS를 우회합니다.
UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
WHERE email = 'smartffy@kakao.com';

-- 4단계: 결과 확인
SELECT 
  id,
  email,
  name,
  organization_id,
  role,
  department,
  created_at
FROM public.profiles
WHERE email = 'smartffy@kakao.com';

-- 5단계: 모든 관련 프로필 확인
SELECT 
  id,
  email,
  name,
  organization_id,
  role,
  department
FROM public.profiles
WHERE organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
ORDER BY created_at ASC;
