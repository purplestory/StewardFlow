-- 김은진 사용자의 organization_id 업데이트
-- 초대 정보에서 organization_id를 가져와서 프로필에 설정

UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'
WHERE email = 'nankej77@naver.com'
  AND organization_id IS NULL;

-- 확인
SELECT id, email, name, role, organization_id 
FROM public.profiles 
WHERE email = 'nankej77@naver.com';
