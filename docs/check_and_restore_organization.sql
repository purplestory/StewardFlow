-- 현재 로그인한 사용자의 프로필과 기관 정보 확인 및 복구

-- 1. 현재 사용자 확인 (Supabase Auth에서)
-- 이 쿼리는 Supabase SQL Editor에서 직접 실행할 수 없으므로,
-- 사용자 ID를 직접 확인해야 합니다.

-- 2. 모든 프로필과 기관 정보 확인
SELECT 
  p.id,
  p.email,
  p.name,
  p.organization_id,
  p.role,
  o.name as organization_name,
  o.id as organization_exists
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.organization_id
ORDER BY p.created_at DESC;

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

-- 4. 기관 목록 확인
SELECT 
  id,
  name,
  created_at
FROM public.organizations
ORDER BY created_at DESC;

-- 5. 특정 사용자의 organization_id 복구 (사용자 ID를 확인한 후 실행)
-- 예: 이동명(smartffy@kakao.com)의 organization_id 복구
UPDATE public.profiles
SET organization_id = (
  SELECT id 
  FROM public.organizations 
  WHERE name = '기관 이름'  -- 실제 기관 이름으로 변경
  LIMIT 1
)
WHERE email = 'smartffy@kakao.com'
  AND organization_id IS NULL;

-- 6. 또는 특정 organization_id로 직접 설정
-- organization_id: 05efc956-4b5b-4dec-8d1c-2689e93086c5 (김은진이 속한 기관)
UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
WHERE email = 'smartffy@kakao.com'  -- 또는 다른 식별자 사용
  AND organization_id IS NULL;
