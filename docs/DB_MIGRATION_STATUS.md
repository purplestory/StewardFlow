# DB MIGRATION STATUS

최종 업데이트: 2026-02-19

## 1. 목적
- 환경별 DB 스키마 적용 상태를 빠르게 확인
- "코드는 반영됐는데 테이블이 없음" 같은 운영 장애를 예방

## 2. 현재 핵심 이슈
- 일부 환경에서 아래 오류가 관측됨:
  - `Could not find the table 'public.book_loans' in the schema cache`
  - `Could not find the table 'public.book_items' in the schema cache`
- 의미: 도서 관련 마이그레이션이 해당 환경에 미적용되었을 가능성이 큼

## 3. 도서 기능 필수 마이그레이션(2026-02-19)
적용 순서:
1. `supabase/migrations/20260219_add_books_feature_to_organizations.sql`
2. `supabase/migrations/20260219_create_book_lending_mvp.sql`
3. `supabase/migrations/20260219_extend_book_lending_self_service.sql`
4. `supabase/migrations/20260219_add_book_gamification_options.sql`

## 4. 검증 SQL
아래 쿼리를 Supabase SQL Editor에서 실행:

```sql
-- 테이블 존재 확인
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('book_items', 'book_loans');

-- organizations 확장 컬럼 확인
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'organizations'
  and column_name in ('features', 'menu_labels', 'menu_order');

-- 도서 기능 토글/라벨/순서 값 확인
select id, features, menu_labels, menu_order
from public.organizations
limit 5;
```

## 5. 환경 상태 기록 템플릿
아래 블록을 환경마다 복사해 체크:

```text
환경명:
확인일:
확인자:
book_items: yes/no
book_loans: yes/no
20260219_* 적용 여부: yes/no
비고:
```

## 6. 장애 대응 순서
1. 에러 메시지에서 누락 테이블 확인
2. 위 4개 마이그레이션 적용 여부 확인
3. 누락분 적용
4. 앱 새로고침 후 도서 홈/도서 운영 페이지 재검증

## 7. 주의
- `loan` 용어/테이블은 현재 확정 도메인이므로 이름 변경 금지
- 운영 데이터가 있는 환경에서 임의 DROP/RENAME 금지
