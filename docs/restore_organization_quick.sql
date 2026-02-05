-- 기관 정보 복구 (빠른 복구)

-- 1. 현재 상황 확인
-- 모든 프로필과 기관 정보 확인
SELECT 
  p.id,
  p.email,
  p.name,
  p.organization_id,
  p.role,
  o.name as organization_name
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.organization_id
ORDER BY p.created_at DESC;

-- 2. 기관 목록 확인
SELECT 
  id,
  name,
  created_at
FROM public.organizations
ORDER BY created_at DESC;

-- 3. organization_id가 NULL인 프로필 확인
SELECT 
  id,
  email,
  name,
  organization_id,
  role,
  created_at
FROM public.profiles
WHERE organization_id IS NULL
ORDER BY created_at DESC;

-- 4. 빠른 복구: smartffy@kakao.com (이동명)의 organization_id 복구
-- 김은진이 속한 기관과 같은 기관으로 설정
UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
WHERE email = 'smartffy@kakao.com'
  AND organization_id IS NULL;

-- 5. 확인
SELECT 
  id,
  email,
  name,
  organization_id,
  role,
  department
FROM public.profiles
WHERE email = 'smartffy@kakao.com';
