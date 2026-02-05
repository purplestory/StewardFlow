-- 사용자 프로필 찾기

-- 1. 모든 프로필 확인 (이메일 부분 일치)
SELECT id, email, name, organization_id, role, department
FROM public.profiles
WHERE email LIKE '%kakao%' OR email LIKE '%smart%'
ORDER BY created_at DESC;

-- 2. 정확한 이메일로 확인 (이전 데이터 기준)
SELECT id, email, name, organization_id, role, department
FROM public.profiles
WHERE email = 'smartfty@kakao.com';

-- 3. 이름으로 찾기
SELECT id, email, name, organization_id, role, department
FROM public.profiles
WHERE name = '이동명';

-- 4. organization_id로 모든 사용자 확인
SELECT id, email, name, organization_id, role, department
FROM public.profiles
WHERE organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
ORDER BY created_at ASC;

-- 5. organization_id가 NULL인 모든 프로필
SELECT id, email, name, organization_id, role, department, created_at
FROM public.profiles
WHERE organization_id IS NULL
ORDER BY created_at DESC;
