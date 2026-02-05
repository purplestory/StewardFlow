-- 이동욱 사용자의 organization_id 수정
-- 다른 사용자들과 동일한 기관에 연결

UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
WHERE id = 'c51ca48f-6903-42da-aadc-eb85fc02b9ba'
  AND email = 'ldw2968@gmail.com';

-- 확인
SELECT id, email, name, role, organization_id
FROM public.profiles
WHERE id = 'c51ca48f-6903-42da-aadc-eb85fc02b9ba';
