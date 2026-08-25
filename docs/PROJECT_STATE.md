# PROJECT STATE

최종 업데이트: 2026-08-24
기준 커밋: `main`/`origin/main`의 `29da08a`

## 0. 배포 상태 (반드시 먼저 확인)
- 원격 Supabase 상태: `Healthy`
- 로컬: P0 인증/테넌트 보안, invite-only 가입, 부서 변경 승인 서버 하드닝, RLS hardening/도서 취소 atomic RPC migration, 도서 내 신청 통합, 의존성/CI/test/Next.js 16 정리가 구현되어 있음
- **코드 배포: 완료** — Vercel `dpl_Ftp6DqqicKEhPBp8DtZuraiCaWMS` `READY`, `https://steward-flow.vercel.app`.
- **원격 RLS 적용: 완료** — migration SHA-256 `7c63ff760df5e3d0c4464ea9a775efe32efc8c40d1cee91d1fe9058bed53871e`, transaction 종료 상태 `0`, read-only postcheck 19개 통과.
- **사전 DB 백업: 유효** — `2026-08-24 05:47 KST`, SHA-256 `3c2b77ccff0627483951dc1875cf20454b66ad8f58ddfe105624e0dceb75f143`, archive 판독 검증 완료, 실제 복원 리허설 미실행.
- **배포 소스 보존: 완료** — 운영 소스는 `29da08a feat: harden StewardFlow production boundaries`로 커밋되어 `origin/main`까지 반영됐다.
- **남은 운영 과제:** OPS-004 migration history reconciliation/복원 리허설, signed-in 회귀 QA.

## 1. 현재 제품 범위
- 코어: 인증, 사용자/권한, 물품/공간/차량 예약/승인/반납
- 확장: 도서 라운지(대여/반납/운영), 독서 기록/게임화(기초)
- 운영: 메뉴/정책/기관/부서/카테고리/감사 로그/휴지통/샘플데이터

## 2. 이번 사이클에서 확정된 내용
- 계정 삭제 service action은 본인 또는 동일 기관 `admin`만 호출 가능하며, 마지막 admin은 앱 사전검사와 조직 행 잠금 기반 profile UPDATE/DELETE trigger로 보호 (원격 적용 완료)
- 조직 `admin`은 자기 테넌트만 관리하며, 전역 기관 작업은 서버 전용 `PLATFORM_ADMIN_USER_IDS` allowlist가 있는 플랫폼 관리자만 수행
- 가입은 관리자 초대 전용이며 기존 `/join-request` 공개 신청 화면은 폐기하고 `/join`으로 리다이렉트
- 초대 수락 시 인증 이메일과 일회성 claim을 검증하고 role/department는 서버가 조회한 초대 레코드 값으로만 확정
- 초대 생성은 actor의 기관으로 고정하며, 부서 manager는 자기 non-null 담당 부서에 `manager`/`user`만 초대하고 `admin` 또는 타 부서 초대는 불가
- manager 탈퇴 승인은 operation ID로 claim하고 동일 기관·동일 부서 user에게 역할을 인계한다. Auth 결과에 따라 finalize/rollback하며 FK SET NULL과 UUID snapshot으로 요청 이력을 보존
- 부서 변경 승인은 서버 액션에서 동일 기관, 승인자 역할/담당 부서, 자기 승인 금지, 대상 사용자/부서/요청 최신 상태를 재검증
- anon 사용자의 `organization_invites` 테이블 직접 조회는 제거하고 초대 token 검증은 서버 경로로 한정
- 내 신청 화면에 `book_loans`를 물품/공간/차량과 함께 통합
- 요청 상태 도서 취소는 원자 RPC를 우선 사용하고, RPC가 없는 pre-migration 환경에서만 조건부 갱신/보상 fallback 사용
- Next.js 16 권장 `proxy.ts`로 전환하고 lint/mobile/typecheck/test/build를 CI quality gate로 고정
- 상단 메인 메뉴 기본 순서: `도서 > 물품 > 공간 > 차량`
- `피드백` 메뉴 위치: 상단 메인이 아니라 `마이메뉴` 내부
- 마이메뉴 버튼의 화살표 심볼 제거
- UI 방향: 중첩 박스 최소화, 모듈형 일관 UI로 통일
- 도서 내부 도메인/테이블 용어는 `loan` 유지 (`lend`로 변경하지 않음)
- 카카오 로그인 콜백에서 일시적 실패 화면 깜빡임 완화 로직 반영
- 관리자 설정에서 초대 링크 만료일(`1/3/7/14/30일`) 선택 가능
- 원격 Supabase에 도서 스키마 부트스트랩 마이그레이션 실적용 완료

## 3. 완료 상태(요약)
- 로컬 P0 보안 구현 완료: 인증/권한 검증, 계정 삭제 operation 프로토콜, 마지막 최고 관리자 보호, 내부 redirect 제한, service-role tenant boundary, invite-only/초대 권한 고정, 부서 변경 승인 서버 하드닝, 위험한 기관 삭제 UI 비활성화
- `20260824090000_harden_tenant_rls_boundaries.sql` 원격 적용 완료: tenant RLS, 부서/마지막 admin trigger, 계정 삭제 snapshot·service-only RPC, `cancel_requested_book_loan_atomic` 및 19개 postcheck 확인
- 내 신청의 도서 대출 상태/원자 취소/승인 후 취소 요청 통합 및 unread 중복 요청 방지 완료
- Next.js `16.3.2`, Vitest, GitHub Actions quality workflow 및 캐시 ignore 정리 완료
- 메뉴 순서 저장 후 새로고침 시 복원되던 버그 수정
- 설정/관리 페이지 공통 스타일 프리미티브 정리
- 편집/삭제 액션을 텍스트 링크에서 아이콘 버튼 중심으로 통일
- 도서 테이블 미적용 환경에서 사용자 친화형 오류 메시지 노출
- 초대 레코드 만료 시각(`organization_invites.expires_at`) 저장/검증 로직 반영

## 4. 현재 위험/주의사항
- 가장 높은 우선순위는 로그인 상태 운영 QA와 OPS-004 migration history/복원 리허설이다.
  - 운영 계정은 `admin` 3명, `manager` 3명, 일반 `user` 0명이다. 기존 admin/manager로는 읽기 전용 권한 QA를 먼저 수행하고, 변경 흐름은 전용 테스트 `user` 초대 후에만 검증한다.
  - hardening 사전 backup은 새 NAS 격리 Supabase PostgreSQL 17.6 DB에 실제 복원해 핵심 테이블 `81`, `profiles=6`, `organizations=2`, `auth.users=8`을 확인했다. 복제 DB에서 hardening migration replay와 RLS/service-only RPC/FK postcheck도 통과했다. 이 snapshot은 hardening 전 것이므로, 현재 운영 상태를 보장하는 새 post-hardening backup/복원 검증과 migration baseline 결정은 계속 남아 있다.
  - NAS 리허설 컨테이너는 전용 네트워크/볼륨과 loopback 전용 포트만 사용하며, 기존 운영 DB·Vercel 환경변수·카카오 OAuth를 재사용하지 않는다.
  - 2026-08-25 post-hardening archive도 새 NAS 격리 DB에 복원해 데이터·hardening postcheck를 통과했다. 다만 DB-only target은 Realtime runtime role이 없어 ACL-inclusive restore가 실패하므로, 이는 full self-hosted cutover가 아니라 DB recovery rehearsal이다. 기준선과 금지된 legacy bootstrap 경로는 `docs/recovery_baseline.md`를 따른다.
- `cancel_requested_book_loan_atomic`은 원격에 존재하며 production API가 원자 RPC 경로를 사용할 수 있다.
- 일반 user를 조직 admin이 직접 삭제하는 Auth 외부 호출에는 actor 강등/대상 tenant 이동의 짧은 TOCTOU가 남아 있다. 완전 제거는 별도 DB deletion authorization marker/RPC 과제로 관리한다.
- hardening은 수동 적용되어 원격 migration history를 수정하지 않았다. history에는 `20260220103000`만 기록되어 로컬 migration 집합과 기준선이 다르다.
  - 현재 legacy migration 111개는 중복/비표준 version이 있어 전체 replay, `db push`, `db reset --linked`, legacy 전체 applied 처리를 금지한다.
  - 새 post-hardening schema/dump를 기준선으로 만들고, 격리된 복원·replay 검증 후에만 history metadata를 정리한다.
- 원격 점검(2026-08-24): `profiles=6`, `organizations=2`, 활성 초대 `0`, privileged orphan `0`, 관리자 없는 기관 `0`, 잘못된 profile 부서 `0`, account deletion null status/중복 pending requester `0`
- account deletion requester/transfer/resolver FK 3개는 원격에서 모두 `ON DELETE SET NULL` 적용 확인
- `.npm/`, `.npm-cache/`는 ignore에 추가했지만 Git에는 1,861개 파일(약 475MB)이 이미 추적 중이다.
  - 별도 커밋으로 추적 제거 및 repository/history 영향 확인 필요
- `.vercelignore`로 `.local-backups`, `.env*`, npm 캐시, Supabase 운영 SQL을 Vercel source upload에서 제외했으며 dry-run으로 확인했다.
- 기본 운영 환경에서는 도서 테이블 미적용 이슈 해소됨
  - 확인: `book_items`, `book_loans` 포함 핵심 도서 테이블 API 응답 확인
  - 주의: 신규/별도 환경에서는 `20260220103000_bootstrap_books_schema.sql` 적용 필요
- 현재 원격에는 `invite_expires_days`, `expires_at` 컬럼이 존재한다.
  - 신규/별도 환경에서는 `supabase/migrations/20260219_add_invite_expiration_policy.sql` 또는 조정된 baseline에 포함되었는지 확인

## 5. 세션 재개 루틴(컨텍스트 절약용)
새 세션 시작 시 아래 순서로만 읽고 시작:
1. `docs/EXECUTION_TRACKER.md`
2. `docs/PROJECT_STATE.md`
3. `docs/NEXT_TASKS.md`
4. `docs/DECISIONS.md` 최근 항목
5. `docs/DB_MIGRATION_STATUS.md` 환경 상태

그리고 터미널에서:
1. `git status --short`
2. `git log --oneline -n 10`
3. 현재 작업 브랜치/원격 동기화 확인

## 6. 운영 규칙
- 기능/정책/UI 결정이 바뀌면 `docs/DECISIONS.md`에 반드시 1줄 추가
- 작업 종료 커밋에는 아래 문서 중 최소 1개 업데이트 포함
  - `docs/PROJECT_STATE.md`
  - `docs/NEXT_TASKS.md`
  - `docs/DB_MIGRATION_STATUS.md`
