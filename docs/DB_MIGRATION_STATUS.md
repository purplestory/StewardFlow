# DB MIGRATION STATUS

최종 업데이트: 2026-08-24

## 1. 목적
- 환경별 DB 스키마 적용 상태를 빠르게 확인
- "코드는 반영됐는데 테이블이 없음" 같은 운영 장애를 예방

## 2. 현재 원격 상태 (2026-08-24)
- Supabase health: `Healthy`
- 데이터 건수/무결성 점검:
  - `profiles`: 6
  - `organizations`: 2
  - 활성 초대: 0
  - privileged orphan profile: 0
  - admin이 없는 organization: 0
- 초대 만료 컬럼:
  - `organizations.invite_expires_days`: 존재
  - `organization_invites.expires_at`: 존재
- 원격 migration history:
  - `20260220103000_bootstrap_books_schema` 단건만 확인
- 애플리케이션 배포: Vercel production deployment `dpl_Ftp6DqqicKEhPBp8DtZuraiCaWMS` `READY`; alias `https://steward-flow.vercel.app`.
- hardening migration 적용: 완료. SHA-256 `7c63ff760df5e3d0c4464ea9a775efe32efc8c40d1cee91d1fe9058bed53871e` 파일을 `psql 18.4`, `ON_ERROR_STOP=1`로 transaction 적용했으며 종료 상태는 `0`이다.
- 적용 후 read-only postcheck 19개가 모두 기대 결과를 반환했다.
- anon REST의 `organization_invites` 조회는 HTTP `401`, 반환 행 `0`으로 차단됨을 확인했다.
- 수동 적용 시 migration history를 수정하지 않아 원격 history는 `20260220103000` 단건 그대로다.
- 현재 Supabase Free 플랜은 자동 백업을 제공하지 않는다.
- 2026-08-24 05:47 KST hardening 사전 수동 백업 완료:
  - dump: `.local-backups/steward-flow/20260824-051551-KST/steward-flow-pre-hardening-20260824-051551-KST.dump`
  - 크기: `621,219 bytes`
  - SHA-256: `3c2b77ccff0627483951dc1875cf20454b66ad8f58ddfe105624e0dceb75f143`
  - 검증: `pg_restore 18.4 --list` 성공, archive 목록 1,147줄, schema-only 추출 9,599줄, data-only 압축 해제 성공
  - NAS 격리 Supabase PostgreSQL 17.6 컨테이너에서 실제 복원 성공. `steward_flow_restore_clean` DB의 핵심 Supabase 테이블 `81`, `profiles=6`, `organizations=2`, `auth.users=8`을 확인했다.
- 이 archive는 hardening 적용 전 snapshot이다. hardening 후 새 backup을 동일 방식으로 복원·검증하고 migration history baseline을 확정하기 전에는 OPS-004를 완료 처리하지 않는다. 로그인 상태 운영 회귀 QA도 남아 있다.

## 2-1. NAS 격리 복원 리허설 (2026-08-24)
- 대상: 별도 프로젝트 `steward-flow-restore-20260824`, `supabase/postgres:17.6.1.136`, 전용 네트워크/볼륨, NAS loopback 전용 포트 `127.0.0.1:15432`.
- 비연결 범위: Vercel production, 카카오 OAuth, 운영 Supabase URL 및 운영 DB에는 연결하지 않았다.
- 초기화: Supabase DB 초기화 SQL과 새 로컬 전용 secrets를 사용했다. 기존 NAS Supabase 프로젝트/컨테이너는 읽기만 했고 수정하지 않았다.
- 복원: `pg_restore --exit-on-error --no-owner --no-privileges`를 `supabase_admin`으로 실행했다. 일반 `postgres` 역할의 첫 시도는 `realtime.list_changes`의 `log_min_messages` function setting 권한 오류로 중단됐고, 실패 DB는 보존했다.
- 검증: archive SHA-256 일치, 컨테이너 health `healthy`, PostgreSQL `17.6`, 핵심 테이블/행 수 확인.
- 한계: Storage object 바이너리, Edge Function secrets, SMTP/OAuth 설정은 DB archive에 포함되지 않으며, 이 리허설은 서비스 전체 cutover 검증이 아니다.

## 2-2. 과거 핵심 이슈 (기록 보존)
- 과거 일부 환경에서 아래 오류가 관측됨:
  - `Could not find the table 'public.book_loans' in the schema cache`
  - `Could not find the table 'public.book_items' in the schema cache`
- 의미: 도서 관련 마이그레이션이 해당 환경에 미적용되었을 가능성이 큼

## 3. 도서 기능 필수 마이그레이션(2026-02-19)
적용 순서:
1. `supabase/migrations/20260219_add_books_feature_to_organizations.sql`
2. `supabase/migrations/20260219_create_book_lending_mvp.sql`
3. `supabase/migrations/20260219_extend_book_lending_self_service.sql`
4. `supabase/migrations/20260219_add_book_gamification_options.sql`

## 3-1. 운영 반영 결과 (2026-02-20)
- 원격 Supabase 적용 파일:
  - `supabase/migrations/20260220103000_bootstrap_books_schema.sql`
- 적용 방식:
  - 기존 원격 migration history 불일치 상태에서 도서 영역만 안전 반영하기 위해, 위 부트스트랩 마이그레이션 단건 적용
- API 검증 결과:
  - `book_items`: OK (조회 응답)
  - `book_loans`: OK (조회 응답)
  - `book_notes`: OK (조회 응답)
  - `book_user_progress`: OK (조회 응답)
  - `book_program_settings`: OK (조회 응답)
  - `book_return_evidences`: OK (조회 응답)

## 3-2. 테넌트 RLS hardening (원격 적용 완료)
- 파일: `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql`
- 적용 SHA-256: `7c63ff760df5e3d0c4464ea9a775efe32efc8c40d1cee91d1fe9058bed53871e`
- 적용 내용:
  1. `profiles` privileged field를 trigger로 보호하고 기본 role을 `user`로 고정
  2. 조직 admin/manager 권한을 같은 `organization_id` 범위로 제한
  3. 전역/pending 사용자 admin 정책 제거
  4. anon의 `organization_invites` 직접 조회 권한/정책 제거
  5. invite-only 운영을 위해 authenticated 사용자의 직접 organization 생성/삭제 권한 제거
  6. 초대 role/department 및 profile privileged field 변경을 서버 검증/trigger 경계로 제한
  7. profile의 non-null 부서가 실제 같은 기관 부서인지 검증하고, 조직 행 잠금 기반 trigger로 마지막 admin UPDATE/DELETE를 차단
  8. account deletion 요청의 immutable UUID snapshot, requester `ON DELETE SET NULL`, operation unique index와 상태 guard 추가
  9. operation ID 기반 claim/rollback/finalize/reject 계정 삭제 RPC를 service-role 전용으로 추가하고 역할 revision·감사·수동 검토 상태를 보존
  10. account deletion/feedback admin 정책을 테넌트 범위로 제한
  11. 요청 상태 도서 대출과 도서 상태를 함께 정리하는 `cancel_requested_book_loan_atomic(uuid, uuid)` 추가
  12. migration-time RLS/policy/trigger/function assertion 추가
- 2026-08-24 원격 read-only preflight:
  - profile의 잘못된 기관/부서 참조 `0`
  - account deletion null status `0`, 중복 pending requester `0`
  - requester/transfer/resolver FK는 현재 모두 `NO ACTION`; 본 migration이 세 FK를 `ON DELETE SET NULL`로 교체
- 적용 결과:
  1. 사용자 확인과 사전 백업/SHA 검증 완료
  2. `psql 18.4`, `ON_ERROR_STOP=1` transaction 종료 상태 `0`
  3. migration 내부 assertion 및 read-only postcheck 19개 통과
  4. 위험 admin/anon/open-insert 정책 `0`, service-only RPC 권한 `4/4`, FK `SET NULL` `3`, 필수 trigger `8`, RLS 대상 `5`
  5. signed-in 사용자/관리자/invite-only/부서 승인/도서 취소/OAuth 회귀 QA는 잔여

## 3-3. Migration history 기준선 불일치
- 로컬에는 누적 migration 파일이 다수 존재하지만 원격 history는 도서 bootstrap 단건만 기록되어 있다.
- 신규 환경에 로컬 migration 전체를 그대로 replay하지 않는다.
- 현재 원격 스키마 dump와 로컬 migration을 대조해 baseline/squash 전략을 확정한 뒤 새 환경 복구 절차를 문서화한다.
- 2026-08-24 백업 archive 대조에서 과거 로컬 migration이 선언한 `can_approve_vehicle`, `get_org_profiles`, `required_role_for_vehicle` 함수가 원격에는 없음을 확인했다. 현재 hardening migration은 이 함수들을 참조하지 않으며, OPS-004 baseline reconciliation에서 유지/폐기 여부를 결정한다.

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

-- 운영 데이터/무결성 요약
select count(*) as profiles_count from public.profiles;
select count(*) as organizations_count from public.organizations;
select count(*) as active_invites
from public.organization_invites
where accepted_at is null
  and revoked_at is null
  and expires_at > now();

select count(*) as orphan_privileged_profiles
from public.profiles
where organization_id is null
  and role in ('admin', 'manager');

select count(*) as organizations_without_admin
from public.organizations as o
where not exists (
  select 1
  from public.profiles as p
  where p.organization_id = o.id
    and p.role = 'admin'
);

select version, name
from supabase_migrations.schema_migrations
order by version;

-- hardening migration 적용 여부 및 현재 정책 확인
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'organization_invites', 'organizations')
order by tablename, policyname;

select tgname
from pg_trigger
where tgrelid in (
  'public.profiles'::regclass,
  'public.account_deletion_requests'::regclass
)
  and not tgisinternal;

-- 계정 삭제 승인 RPC와 보존 스키마 확인
select
  to_regprocedure('public.claim_account_deletion_request_for_approval(uuid,uuid,uuid,text)') as claim_rpc,
  to_regprocedure('public.rollback_account_deletion_request_approval(uuid,uuid,uuid)') as rollback_rpc,
  to_regprocedure('public.finalize_account_deletion_request_approval(uuid,uuid,uuid)') as finalize_rpc,
  to_regprocedure('public.reject_account_deletion_request(uuid,uuid,text)') as reject_rpc;

select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'account_deletion_requests'
  and column_name in (
    'requester_id',
    'requester_user_id_snapshot',
    'transfer_user_id_snapshot',
    'approval_operation_id',
    'transfer_expected_privilege_version'
  )
order by column_name;

select conname, confdeltype
from pg_constraint
where conrelid = 'public.account_deletion_requests'::regclass
  and conname = 'account_deletion_requests_requester_id_fkey';

-- 요청 상태 도서 취소 원자 함수 적용 확인
select to_regprocedure(
  'public.cancel_requested_book_loan_atomic(uuid,uuid)'
) as cancel_requested_book_loan_atomic;
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
20260824090000_harden_tenant_rls_boundaries 적용 여부: yes/no
account deletion RPC 4종: yes/no
profile 부서/마지막 admin/account deletion guard trigger: yes/no
원격 migration history 확인:
Supabase 플랜/자동 백업 제공 여부:
백업 위치/복원 절차:
원격 실행 사용자 확인 시각:
비고:
```

## 6. 장애 대응 순서
1. 에러 메시지에서 누락 테이블 확인
2. 원격 migration history와 현재 스키마를 함께 확인
3. 백업 없이 누락 migration을 즉시 replay하지 않음
4. 승인된 migration/baseline만 적용
5. 앱 새로고침 후 인증/초대/도서/관리자 경계를 재검증

## 7. 주의
- `loan` 용어/테이블은 현재 확정 도메인이므로 이름 변경 금지
- 운영 데이터가 있는 환경에서 임의 DROP/RENAME 금지
- 원격 migration history가 불완전하므로 로컬 migration 전체 일괄 적용 금지
- Supabase Free 플랜에는 자동 백업이 없으므로 대시보드 자동 백업을 전제로 migration을 실행하지 않음
- `20260824090000_harden_tenant_rls_boundaries.sql`은 원격 적용 완료. 수동 적용으로 migration history에는 기록하지 않았으므로 로컬 migration 전체 replay는 금지하며 OPS-004에서 기준선을 조정한다.

## 8. 초대 만료 정책 마이그레이션 (2026-02-19)
- 파일: `supabase/migrations/20260219_add_invite_expiration_policy.sql`
- 추가 내용:
1. `organizations.invite_expires_days` (1~30일, 기본 7일)
2. `organization_invites.expires_at` (초대별 만료 시각)
3. 기존 초대 데이터 backfill + 만료 인덱스 + insert trigger
- 2026-08-24 원격 확인: 두 컬럼 모두 존재
