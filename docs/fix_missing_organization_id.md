# organization_id 누락 문제 해결 가이드

초대 링크로 가입한 사용자의 `organization_id`가 NULL인 경우 해결 방법입니다.

## 문제 확인

다음 SQL로 `organization_id`가 NULL인 사용자를 확인할 수 있습니다:

```sql
SELECT id, email, name, role, organization_id 
FROM public.profiles 
WHERE organization_id IS NULL;
```

## 해결 방법

### 1단계: 초대 정보 확인

해당 사용자의 초대 정보를 확인합니다:

```sql
SELECT id, email, name, organization_id, accepted_at, created_at
FROM public.organization_invites
WHERE email = 'nankej77@naver.com'  -- 김은진 사용자의 이메일
   OR name = '김은진'
ORDER BY created_at DESC;
```

### 2단계: organization_id 업데이트

초대 정보에서 `organization_id`를 확인한 후, 사용자 프로필을 업데이트합니다:

```sql
-- 방법 1: 이메일로 찾아서 업데이트
UPDATE public.profiles
SET organization_id = (
  SELECT organization_id 
  FROM public.organization_invites 
  WHERE email = 'nankej77@naver.com'
    AND accepted_at IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE email = 'nankej77@naver.com'
  AND organization_id IS NULL;

-- 방법 2: 초대 ID를 알고 있는 경우
UPDATE public.profiles
SET organization_id = '05efc956-4b5b-4dec-8d1c-2689e93086c5'  -- organization_id
WHERE email = 'nankej77@naver.com'
  AND organization_id IS NULL;
```

### 3단계: 확인

```sql
SELECT id, email, name, role, organization_id 
FROM public.profiles 
WHERE email = 'nankej77@naver.com';
```

## 일괄 수정 (여러 사용자)

여러 사용자의 `organization_id`를 한 번에 수정하려면:

```sql
-- 초대를 수락한 모든 사용자의 organization_id 업데이트
UPDATE public.profiles p
SET organization_id = i.organization_id
FROM public.organization_invites i
WHERE (p.email = i.email OR p.name = i.name)
  AND i.accepted_at IS NOT NULL
  AND p.organization_id IS NULL
  AND i.organization_id IS NOT NULL;
```

## 예방 조치

이 문제를 방지하기 위해 코드가 개선되었습니다:
- 초대 링크 처리 시 `organization_id`가 확실히 설정되도록 수정
- 기존 프로필이 있어도 `organization_id`가 없으면 초대의 `organization_id`로 업데이트
