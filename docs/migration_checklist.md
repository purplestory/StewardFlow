# 데이터베이스 마이그레이션 체크리스트

이 문서는 프로젝트에 필요한 모든 데이터베이스 마이그레이션을 확인하고 실행하는 가이드입니다.

## 실행 방법

1. Supabase 대시보드 접속
2. SQL Editor 열기
3. 아래 마이그레이션을 순서대로 실행
4. 각 마이그레이션 실행 후 체크박스에 체크

## 필수 마이그레이션

### ✅ 1. 카테고리 관리 기능
**파일**: `supabase/migrations/20260208_add_asset_categories.sql`

```sql
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS asset_categories jsonb DEFAULT '[]'::jsonb;
```

**기능**: 자산 카테고리를 관리하고 순서를 변경할 수 있게 합니다.

**확인 방법**: 시스템 설정 > 메뉴 설정에서 카테고리 관리가 작동하는지 확인

---

### ✅ 2. 부서 순서 관리 기능
**파일**: `supabase/migrations/20260208_add_department_order.sql`

```sql
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS department_order jsonb DEFAULT '[]'::jsonb;
```

**기능**: 부서 목록의 순서를 드래그앤드롭으로 변경할 수 있게 합니다.

**확인 방법**: 
- 시스템 설정 > 시스템 설정에서 부서 목록 순서 변경
- 사용자 초대 페이지의 부서 선택 드롭다운 순서 확인

---

### ✅ 3. 초대 이메일 선택사항
**파일**: `supabase/migrations/20260208_make_invite_email_nullable.sql`

```sql
ALTER TABLE public.organization_invites 
ALTER COLUMN email DROP NOT NULL;
```

**기능**: 초대 링크 생성 시 이메일을 선택사항으로 만듭니다.

**확인 방법**: 사용자 권한 관리에서 이메일 없이 초대 링크 생성 가능한지 확인

---

## 마이그레이션 실행 순서

위의 마이그레이션들은 서로 독립적이므로 순서는 중요하지 않습니다. 하지만 다음 순서를 권장합니다:

1. 카테고리 관리 (가장 기본적인 기능)
2. 부서 순서 관리
3. 초대 이메일 선택사항

## 마이그레이션 실행 확인

각 마이그레이션 실행 후 다음 명령으로 확인할 수 있습니다:

```sql
-- 카테고리 컬럼 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'asset_categories';

-- 부서 순서 컬럼 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'department_order';

-- 초대 이메일 컬럼 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'organization_invites' 
AND column_name = 'email';
```

## 문제 해결

### "column already exists" 오류
- 이미 마이그레이션이 실행된 것입니다. 다음 마이그레이션으로 진행하세요.

### "permission denied" 오류
- Supabase 대시보드에서 올바른 프로젝트에 로그인했는지 확인하세요.
- Service Role 키가 필요한 경우가 있을 수 있습니다.

### "syntax error" 오류
- SQL 문을 복사할 때 따옴표나 특수문자가 잘못 복사되었을 수 있습니다.
- 마이그레이션 파일을 직접 확인하세요.

## 롤백 (필요한 경우)

마이그레이션을 되돌려야 하는 경우:

```sql
-- 카테고리 컬럼 제거
ALTER TABLE public.organizations DROP COLUMN IF EXISTS asset_categories;

-- 부서 순서 컬럼 제거
ALTER TABLE public.organizations DROP COLUMN IF EXISTS department_order;

-- 초대 이메일을 다시 NOT NULL로 변경
ALTER TABLE public.organization_invites 
ALTER COLUMN email SET NOT NULL;
```

**주의**: 롤백 시 해당 기능이 작동하지 않게 됩니다. 데이터 손실이 발생할 수 있으므로 주의하세요.

## 추가 정보

- 모든 마이그레이션 파일은 `supabase/migrations/` 디렉토리에 있습니다.
- 마이그레이션 실행 후 애플리케이션을 새로고침하세요.
- 문제가 발생하면 브라우저 콘솔과 Supabase 로그를 확인하세요.
