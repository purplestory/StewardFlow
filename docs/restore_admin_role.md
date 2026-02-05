# 관리자 역할 복구 가이드

초대 링크를 클릭하여 역할이 변경된 경우, 다음 방법으로 관리자 역할을 복구할 수 있습니다.

## 방법 1: Supabase SQL Editor 사용 (가장 간단)

### 1단계: 본인의 사용자 ID 확인

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. 왼쪽 사이드바에서 **"Authentication"** → **"Users"** 클릭
4. 본인의 이메일을 찾아 **"UUID"** 복사

또는 SQL Editor에서 다음 쿼리로 확인:

```sql
SELECT id, email, name, role 
FROM public.profiles 
WHERE email = '본인의-이메일@example.com';
```

### 2단계: 역할 변경

SQL Editor에서 다음 SQL 실행:

```sql
-- 본인의 이메일로 찾아서 역할 변경
UPDATE public.profiles
SET role = 'admin'
WHERE email = '본인의-이메일@example.com';

-- 또는 UUID로 직접 변경
UPDATE public.profiles
SET role = 'admin'
WHERE id = '본인의-uuid-여기에-입력';
```

### 3단계: 확인

```sql
SELECT id, email, name, role 
FROM public.profiles 
WHERE email = '본인의-이메일@example.com';
```

`role` 컬럼이 `admin`으로 표시되면 성공입니다.

## 방법 2: 다른 관리자 계정 사용

다른 관리자 계정이 있다면:
1. 해당 계정으로 로그인
2. 사용자 관리 페이지(`/settings/users`) 접속
3. 본인의 역할을 "관리자"로 변경

## 방법 3: 임시 RLS 비활성화 (고급)

만약 위 방법이 모두 작동하지 않는다면:

```sql
-- 1. RLS 임시 비활성화
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. 역할 변경
UPDATE public.profiles
SET role = 'admin'
WHERE email = '본인의-이메일@example.com';

-- 3. RLS 다시 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

## 주의사항

- ⚠️ SQL을 실행하기 전에 반드시 본인의 이메일/UUID를 확인하세요
- 🔄 변경 후 페이지를 새로고침하세요
- 📝 변경 사항이 즉시 반영됩니다
