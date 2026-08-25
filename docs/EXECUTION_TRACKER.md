# 실행 트래커 (Single Source of Truth)

최종 업데이트: 2026-08-25
담당: Codex + 사용자

## 0) 운영 원칙 (필수)
- 모든 작업은 이 문서의 `1) 작업 목록`에 먼저 등록한 뒤 진행한다.
- 구현 시작 전: 대상 항목 상태를 `TODO -> IN_PROGRESS`로 변경한다.
- 구현 완료 후: 검증 결과를 남기고 `DONE`으로 변경한다.
- 문제 발생 시: `3) 이슈/RCA 로그`에 원인/조치/재발방지까지 반드시 기록한다.
- 새 세션 시작 시: 이 문서만 먼저 읽고 작업을 재개한다.

## 1) 작업 목록 (Backlog)
상태: `TODO | IN_PROGRESS | BLOCKED | DONE`

| ID | 우선순위 | 상태 | 작업 | 완료 기준(AC) | 관련 파일 |
|---|---|---|---|---|---|
| UI-001 | P0 | DONE | 관리페이지 리스트 UI 통일(승인정책/부서목록/등록사용자/물품관리/예약승인/불용품양도/피드백) | 카드 행 간격 대신 라인 중심 구분, 액션 버튼 정렬/가독성 통일, 모바일 오버플로우 없음 | `src/components/settings/ApprovalPolicyManager.tsx`, `src/components/settings/DepartmentManager.tsx`, `src/components/settings/UserRoleManager.tsx`, `src/components/manage/ReservationManager.tsx`, `src/components/assets/AssetTransferRequestsPanel.tsx`, `src/components/feedback/FeedbackList.tsx`, `src/components/manage/AssetAdminPanel.tsx` |
| UI-002 | P0 | DONE | 예약승인 달력 모드 데이터 표시 복구 | 목록 모드와 달력 모드 데이터 건수/기간이 일치하고, 캘린더 클릭 시 최소 정보 + 상세 팝오버 표시 | `src/components/manage/ReservationCalendarView.tsx`, `src/components/manage/reservation-manager-shared.ts`, `src/components/manage/ReservationManager.tsx`, `src/components/manage/SpaceReservationManager.tsx`, `src/components/manage/VehicleReservationManager.tsx` |
| UI-003 | P1 | DONE | 내 대여 신청에 물품/공간/차량/도서 통합 표시 + 승인 완료 취소 플로우 | 리소스 타입별 신청내역 노출, 승인 상태 취소 시 사유 입력 + 관리자 전달 | `src/app/api/reservations/my/route.ts`, `src/components/my/ReservationsClient.tsx`, `src/hooks/useReservations.ts` |
| UI-004 | P1 | TODO | 예약 워크스페이스 단순화(월 기본 + 주/일 제거 여부 최종 반영) | 월 뷰 기본/단일화 또는 설정 기반 노출, 불필요 컨트롤 제거 후 레이아웃 안정 | `src/components/assets/ReservationCalendar.tsx`, `src/components/manage/SpaceReservationManager.tsx`, `src/components/manage/VehicleReservationManager.tsx` |
| UX-001 | P1 | TODO | 디테일 페이지 헤더/브레드크럼/편집 버튼 배치 규칙 고정 | 데스크톱은 이미지 좌/정보 우, 모바일은 단일 컬럼, 브레드크럼 가독성 개선, 버튼 위치 일관 | `src/app/globals.css`, 관련 detail client 컴포넌트 |
| PERF-001 | P1 | TODO | 상단 탭 전환 시 깜빡임/재로딩 체감 완화 | 자원관리 탭 전환 시 헤더 깜빡임 없음, 도서 관리 첫 진입 로딩 최소화 | `src/components/manage/AssetAdminPanel.tsx`, `src/components/layout/Header.tsx` |
| OPS-001 | P2 | TODO | 문서 운영 고정화 | 기능 커밋마다 본 문서와 `DECISIONS.md` 동시 갱신 | `docs/EXECUTION_TRACKER.md`, `docs/DECISIONS.md` |
| SEC-001 | P0 | DONE | 계정 삭제 인증/권한 및 OAuth 내부 리다이렉트 강제 | 본인 또는 동일 기관 관리자만 계정 삭제, 기관별 마지막 최고 관리자 삭제 차단, 외부 `next` URL 차단, 대상 lint/test/typecheck 통과 | `src/actions/auth-actions.ts`, `src/app/auth/callback/page.tsx`, `src/lib/auth-redirect.ts` |
| SEC-002 | P0 | DONE | 관리자 service-role 경로 테넌트 경계 적용 | 일반 조직 관리자는 자기 조직만 조회/관리, 전역 작업은 `PLATFORM_ADMIN_USER_IDS` 서버 allowlist 필수, 비트랜잭션 기관 삭제 비활성화 | `src/actions/admin-organization-actions.ts`, `src/components/settings/UserRoleManager.tsx`, `src/components/settings/OrganizationManager.tsx` |
| SEC-003 | P0 | DONE | invite-only 가입 및 초대 수락 권한 고정 | `/join-request` 폐기, 초대 이메일 일치/일회성 claim 검증, 가입자의 role/department는 서버 초대 레코드로만 확정. 초대는 actor의 기관으로 고정하고 manager는 자기 non-null 부서에 `manager`/`user`만 초대 | `src/app/join-request/page.tsx`, `src/app/join/page.tsx`, `src/actions/invite-actions.ts` |
| SEC-004 | P0 | DONE | 부서 변경 승인 서버 경계 강화 | 서버에서 승인자 인증/동일 기관/manager 담당 부서/자기 승인/대상 역할/요청 최신 상태를 검증하고 부분 실패 시 보상 복구 | `src/actions/admin-organization-actions.ts`, `src/components/settings/UserRoleManager.tsx` |
| SEC-005 | P0 | DONE | 계정 삭제 승인 멱등·보상 워크플로우 | 고유 operation ID로 요청을 claim하고 역할 인계 후 Auth 결과에 따라 finalize/rollback. 불확실·충돌 상태는 수동 검토로 보존하며 마지막 admin 손실은 DB trigger로 차단 | `src/actions/auth-actions.ts`, `src/components/settings/UserRoleManager.tsx`, `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql` |
| DB-001 | P0 | DONE | 테넌트 RLS 강화 마이그레이션 작성 및 위험 정책 감사 | privileged profile/부서 실존/마지막 admin 보호, 전역 admin 정책과 anon invite 조회 제거, 계정 삭제 snapshot·RPC, 검증 assertion 포함 | `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql` |
| DB-002 | P0 | DONE | 도서 신청 취소 원자 처리 및 중복 취소 요청 방지 | `cancel_requested_book_loan_atomic` RPC 우선 사용, 함수 미적용 환경에만 보상 fallback, 동일 unread 취소 알림 중복 생성 방지 | `src/app/api/reservations/my/route.ts`, `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql` |
| QA-001 | P0 | DONE | 의존성/Next.js 16/CI/테스트 기반 정리 | Next.js 16.3.2, `middleware -> proxy`, lint/mobile/typecheck/test/build CI, auth redirect 단위 테스트 구성 | `package.json`, `src/proxy.ts`, `.github/workflows/quality.yml`, `src/lib/auth-redirect.test.ts` |
| QA-002 | P0 | IN_PROGRESS | 운영 signed-in 역할·테넌트 경계 회귀 QA | 기존 admin/manager의 읽기 전용 경로 검증 후, 전용 test user를 초대해 invite/부서 승인/도서 취소를 검증. 실제 계정 삭제는 별도 실행 승인 필요 | production, `src/actions/invite-actions.ts`, `src/actions/admin-organization-actions.ts`, `src/actions/auth-actions.ts` |
| OPS-002 | P0 | DONE | 2026-08-24 로컬 변경 프로덕션 배포 | 실행 직전 사용자 확인 후 Vercel production READY, 운영 alias 및 공개 smoke 확인 | Vercel 배포, `.vercelignore` |
| OPS-003 | P0 | DONE | RLS 강화 마이그레이션 원격 적용 | 수동 백업과 사용자 확인 후 transaction 적용, assertion 및 19개 read-only postcheck 통과 | Supabase 원격, 해당 migration |
| OPS-004 | P0 | IN_PROGRESS | 원격 migration history 기준선 조정 및 복구 검증 | ACL-inclusive DB recovery와 normalized catalog 비교는 완료; 원격 단건 history와 canonical baseline 전략 결정이 남음 | `supabase/migrations`, `docs/DB_MIGRATION_STATUS.md` |
| OPS-005 | P1 | TODO | 추적 중인 npm 캐시 제거 | Git 추적 1,861개 파일(약 475MB)을 history 영향 검토 후 제거, 재추적 방지 확인 | `.npm/`, `.npm-cache/`, `.gitignore` |
| OPS-006 | P0 | DONE | RLS 적용 전 원격 DB 수동 백업 | custom-format dump, SHA-256, archive 목록·schema/data 압축 해제 검증 완료 | `.local-backups/steward-flow/20260824-051551-KST/` (Git 제외) |
| OPS-007 | P0 | DONE | 배포 소스 커밋/푸시 및 재현성 확보 | `29da08a`를 커밋하고 `origin/main` 반영까지 확인 | 현재 로컬 변경 전체 |

## 2) 작업 로그 (Execution Log)
시간 기준: Asia/Seoul

### 2026-08-25
- [IN_PROGRESS/REMOTE] OPS-004 post-hardening snapshot and replay
  - `scripts/backup-post-hardening.sh`로 현재 운영 DB의 custom-format archive를 새로 생성했다. PostgreSQL native hidden password prompt를 사용했으며 password는 파일, Git, 명령 인수, 대화에 저장하지 않았다.
  - 로컬 archive는 `664,803 bytes`, SHA-256 `2a059ae35067385e868ed17e66c6581996f4364f3d61dba0a5d34db920d18d6c`, TOC `1,128`줄이며 TOC/schema-only/data stream 판독을 통과했다. 산출물은 restricted local backup directory의 `700/600` 권한이다.
  - NAS restricted backup directory에 암호화된 SSH로 복사했고 SHA-256이 일치했다. 새 `steward_flow_restore_post_hardening_20260825` DB에 `supabase_admin`, `--exit-on-error --no-owner --no-privileges`로 복원했다.
  - 복원 뒤 idempotent hardening migration을 재적용해 RLS `5`, anon invite SELECT `false`, 도서 취소 RPC 존재, service-only RPC `4/4`, authenticated 실행 `0`, service-role 실행 `4`, account-deletion FK `SET NULL 3`을 확인했다. 데이터 핵심값은 `profiles=6`, `organizations=2`, `auth.users=8`, 활성 초대 `0`이다.
  - RCA: DB-only target에서 ACL까지 포함한 restore는 `supabase_realtime_admin` runtime role 부재로 중단됐다. 따라서 이 환경은 DB archive/hardening rehearsal 전용이며 full self-hosted cutover 기준이 아니다. 완전한 Supabase stack/runtime role을 준비한 뒤 ACL-inclusive restore를 별도 검증한다.
  - 기준선 근거와 legacy bootstrap 금지 규칙은 `docs/recovery_baseline.md`에 고정했다. production migration history는 계속 수정하지 않는다.
- [DONE/SCOPE: DB RECOVERY] OPS-004 Realtime role and ACL-inclusive restore
  - 별도 `steward-flow-runtime-rehearsal-20260825` NAS 런타임에서 PostgreSQL 17.6과 Realtime 2.102.3을 기동해 `supabase_realtime_admin` 역할을 초기화했다. NAS의 신규 Docker bridge forwarding은 호스트 방화벽이 차단하므로 Realtime은 DB 네트워크 namespace를 공유했다. 방화벽, 기존 NAS 스택, Vercel, OAuth에는 변경이 없다.
  - 일반 one-pass ACL restore의 GraphQL wrapper 순서 의존성(`graphql_public.graphql` ACL)을 r2 진단 DB에서 확인했다. r3 새 빈 DB에는 archive TOC `5260`만 제외한 pre-data, production-equivalent GraphQL prelude, data, post-data를 순서대로 적용했다. 원본 archive와 운영 DB는 수정하지 않았다.
  - r3 최종 postcheck는 `profiles=6`, `organizations=2`, `auth.users=8`, active invites `0`, RLS 대상 `5`, anon invite SELECT `false`, service-only RPC `4/4`, authenticated execute `0`, service-role execute `4`, account-deletion FK `SET NULL 3`을 반환했다.
  - public table/function/policy/RLS/trigger 233개 정규화 카탈로그는 원본 archive와 r3에서 완전히 일치했고 SHA-256은 양쪽 모두 `ad48c3ceaf1d3c01b1140a89bbab6ca1578ac4d87a71af20d910752e01b133e5`다. canonical migration history/baseline 결정과 signed-in QA는 계속 남는다.

### 2026-08-24
- [DONE/LOCAL] SEC-001, SEC-002
  - `deleteUserAccount`에 호출자 인증, 본인/동일 기관 관리자 권한 검증, 기관별 마지막 최고 관리자 보호, FK cascade 기반 삭제 순서를 적용했다.
  - OAuth 콜백의 `next`는 내부 경로만 허용하고 절대 URL, protocol-relative URL, 백슬래시/제어문자 변형을 차단했다.
  - service-role 기반 기관/사용자 관리에 테넌트 경계를 적용하고, 전역 기관 생성/이관은 서버 전용 `PLATFORM_ADMIN_USER_IDS` allowlist로 제한했다.
  - 트랜잭션 없이 멤버 해제 후 기관을 삭제하던 클라이언트 경로는 비활성화하고 운영자 문의 안내로 대체했다. hardening migration은 authenticated 사용자의 직접 기관 삭제 권한도 제거한다.
- [DONE/LOCAL] SEC-003, SEC-004
  - 공개 가입 신청 경로를 폐기하고 `/join-request`는 초대 전용 `/join`으로 이동하도록 변경했다.
  - 초대 수락 시 인증 이메일을 검증하고 초대 레코드를 먼저 일회성 claim하며, role/department는 클라이언트 값이 아닌 초대 레코드 값으로만 적용한다.
  - 초대 생성은 호출자의 기관으로 고정하고, 부서 manager는 자기 non-null 담당 부서에 `manager` 또는 `user`만 초대할 수 있도록 서버와 RLS 범위를 맞췄다.
  - 부서 변경 승인은 service-role 서버 액션에서 동일 기관, 승인자 역할/담당 부서, 자기 승인 금지, 대상 사용자/목적 부서/요청 최신 상태를 재검증하고 요청 상태 갱신 실패 시 프로필 부서를 보상 복구한다.
- [DONE/LOCAL] SEC-005
  - manager 계정 탈퇴 승인은 고유 operation ID로 `pending -> processing`을 claim하고, 동일 기관·동일 부서의 현재 `user`에게 manager 역할을 인계한 뒤 Auth 삭제 결과에 따라 finalize 또는 rollback한다.
  - Auth 결과가 불명확하거나 역할 상태가 충돌하면 자동 덮어쓰기를 중단하고 `processing` 또는 `manual_review`로 보존해 관리자 화면과 감사 로그에서 확인할 수 있게 했다.
  - 삭제 후에도 요청 이력은 nullable requester FK와 immutable UUID snapshot으로 남기며, 마지막 admin 손실은 조직 행 잠금 기반 profile UPDATE/DELETE trigger가 service-role/Auth cascade에도 차단한다.
- [DONE/LOCAL] DB-001
  - `20260824090000_harden_tenant_rls_boundaries.sql` 작성: privileged profile 필드와 실제 기관 부서 검증, 마지막 admin trigger, 계정 삭제 snapshot/4개 service-only RPC, 테넌트별 admin/manager 정책, anon invite 조회와 전역 admin 정책 제거.
  - 이 항목 작성 시점에는 원격 미적용이었으며, 아래 OPS-003에서 적용을 완료했다.
- [DONE/LOCAL] DB-002
  - 요청 상태 도서 취소는 `cancel_requested_book_loan_atomic` RPC를 우선 사용하도록 연결했다. RPC가 실제로 없는 pre-migration 환경에서만 사전 활성 대출 조회와 보상 복구가 있는 호환 경로를 사용한다.
  - 승인 후 취소 요청은 같은 예약/도서 대출에 대한 unread 알림이 있으면 새 알림을 만들지 않고 `alreadyRequested`로 응답한다.
- [DONE/LOCAL] UI-003
  - `book_loans`를 내 신청 API/훅/UI에 통합하고 요청 취소, 승인 후 취소 사유 전달, 상태 표시를 연결했다.
- [DONE/LOCAL] QA-001
  - Next.js `16.3.2` 및 관련 의존성 갱신, Next.js 16 `proxy.ts` 전환, Vitest 단위 테스트와 GitHub Actions quality gate를 추가했다.
  - lint/typecheck/test/build 기준을 스크립트와 CI에 고정하고 Supabase/Vercel/npm 캐시 ignore를 보강했다.
  - 최종 검증: full lint, mobile overflow lint, typecheck, 23 tests, webpack production build(50 routes), `git diff --check` 통과. `npm audit --omit=dev` 취약점 `0`.
  - 로컬 공개 smoke: `/login`, `/join-request`, invalid `/join`, `/books`, `/my` 렌더링 확인. 공개 초대 오류에서 내부 환경변수 이름 노출을 제거했다.
- [REMOTE AUDIT] Supabase
  - 상태 `Healthy`; `profiles=6`, `organizations=2`, 활성 초대 `0`.
  - privileged orphan `0`, 관리자 없는 기관 `0`, 초대 만료 컬럼 존재를 확인했다.
  - profile의 잘못된 기관/부서 참조 `0`, account deletion null status `0`, 중복 pending requester `0`을 확인했다.
  - 감사 시점에는 account deletion requester/transfer/resolver FK 3개가 모두 `NO ACTION`이었고, 이후 OPS-003에서 `ON DELETE SET NULL` 교체를 확인했다.
  - 원격 migration history는 `20260220103000_bootstrap_books_schema` 단건만 확인되었다.
  - 위험 정책 감사 당시에는 코드와 migration이 미적용이었으며, 이후 OPS-002/003에서 운영 반영을 완료했다.
- [DONE/BACKUP] OPS-006
  - 2026-08-24 05:47 KST에 hardening 적용 전 원격 DB를 custom-format `pg_dump`로 백업했다.
  - 위치: `.local-backups/steward-flow/20260824-051551-KST/steward-flow-pre-hardening-20260824-051551-KST.dump` (로컬 전용, Git 제외)
  - 크기: `621,219 bytes`; SHA-256: `3c2b77ccff0627483951dc1875cf20454b66ad8f58ddfe105624e0dceb75f143`.
  - `pg_restore 18.4 --list`, schema-only 추출, 전체 data-only 압축 해제에 성공했고 auth/public/storage 핵심 객체와 주요 TABLE DATA 항목을 확인했다.
  - 로컬 백업 디렉터리 권한은 `700`, dump와 검증 산출물은 `600`으로 제한했다.
  - 백업을 위해 사용자가 Supabase Database Password를 재설정했다. 비밀번호 값은 저장하지 않았으며, 기존 외부 직접 DB 연결이 있다면 새 비밀번호로 갱신해야 한다.
  - 이는 백업 파일 판독 검증이며 실제 별도 DB 복원 리허설은 아직 실행하지 않았다. 백업 시점에는 코드와 migration이 미실행이었고 이후 OPS-002/003에서 완료했다.
- [DONE/REMOTE] OPS-002
  - 첫 Vercel dry-run에서 `.local-backups/`와 약 `492 MB`의 `.npm/` 캐시가 업로드 후보에 포함된 것을 발견했다. 실제 배포 전에 `.vercelignore`를 추가했고, 재검증 결과 `204`개 파일/`1,817,707 bytes`이며 민감·캐시 경로 포함은 `0`이었다.
  - Vercel deployment `dpl_Ftp6DqqicKEhPBp8DtZuraiCaWMS`가 `READY`이며 production alias `https://steward-flow.vercel.app` 연결을 확인했다.
  - Next.js `16.3.2`, TypeScript, 50개 route build가 통과했다. `/login`, `/join-request`, invalid `/join`, `/books`, `/my` 공개 smoke와 내부 오류명 미노출을 확인했다.
  - production 소스는 이후 `29da08a feat: harden StewardFlow production boundaries`로 커밋했고 `origin/main` 반영까지 확인했다.
- [DONE/REMOTE] OPS-003
  - 백업과 migration SHA-256 `7c63ff760df5e3d0c4464ea9a775efe32efc8c40d1cee91d1fe9058bed53871e`를 재확인한 뒤 `psql 18.4`, `ON_ERROR_STOP=1`로 transaction 적용했다(종료 상태 `0`).
  - read-only postcheck 19개가 모두 기대 결과를 반환했다: 위험 admin/anon/open-insert 정책 `0`, service RPC `4`, authenticated 실행 권한 `0`, service-role 실행 권한 `4`, FK `SET NULL` `3`, 필수 trigger `8`, RLS 대상 `5`.
  - 실제 anon REST 조회에서도 `organization_invites`가 HTTP `401`, 반환 행 `0`으로 차단됐다.
  - `profiles=6`, `organizations=2`, 활성 초대/privileged orphan/관리자 없는 기관/잘못된 부서 `0`으로 기존 데이터 무결성이 유지됐다.
  - 수동 적용이므로 `supabase_migrations.schema_migrations`는 수정하지 않았고 원격 history는 `20260220103000` 단건 그대로다.
- [IN_PROGRESS/REMOTE] OPS-004
  - NAS에 기존 스택과 분리된 `steward-flow-restore-20260824` PostgreSQL 17.6 기반 Supabase 복원 컨테이너를 만들었다. 전용 네트워크/볼륨을 사용하고 `127.0.0.1:15432`만 바인딩했으며 Vercel, 카카오 OAuth, 운영 Supabase에는 연결하지 않았다.
  - hardening 전 custom-format backup의 SHA-256을 재검증한 뒤 암호화된 SSH로 전용 경로에 전송했다. NAS에서의 SHA-256도 `3c2b77ccff0627483951dc1875cf20454b66ad8f58ddfe105624e0dceb75f143`로 일치했다.
  - 첫 빈 DB `steward_flow_restore`는 일반 `postgres` 역할이 `realtime` 함수의 `log_min_messages` 설정을 복원할 권한이 없어 중단됐다. 해당 DB는 원인 기록용으로 보존했고, `supabase_admin`으로 새 빈 `steward_flow_restore_clean` DB에 재시도해 `pg_restore --exit-on-error --no-owner --no-privileges`를 성공시켰다.
  - 성공 DB에서 PostgreSQL `17.6`, 핵심 Supabase 테이블 `81`, `profiles=6`, `organizations=2`, `auth.users=8`을 확인했다. 이는 hardening 전 snapshot의 복원 호환성 검증이며 현재 운영 전환이나 외부 노출은 아니다.
  - `steward_flow_restore_clean`의 복제 DB에 `20260824090000_harden_tenant_rls_boundaries.sql`을 `ON_ERROR_STOP=1`로 replay해 transaction 및 내부 assertion을 통과했다. postcheck는 `RLS 대상 5`, anon 초대 SELECT `false`, 도서 취소 RPC 존재, service-only RPC `4/4`, authenticated 실행 `0`, service-role 실행 `4`, 계정삭제 FK `SET NULL 3`으로 운영 점검 결과와 일치했다.
  - 남은 조건: 현재 운영 시점의 새 backup과 schema dump를 생성해 동일 환경에서 재검증하고, 그 산출물을 기준으로 migration history baseline 전략을 확정한다. legacy migration 전체 replay와 원격 history 일괄 수정은 계속 금지한다.
- [DONE/GIT] OPS-007
  - `29da08a feat: harden StewardFlow production boundaries`를 `origin/main`에 반영했고, 로컬/원격 HEAD 일치를 확인했다.
- [IN_PROGRESS/REMOTE QA] QA-002
  - 운영 role 집계는 `admin=3`, `manager=3`, 일반 `user=0`, 기관 `2`, 부서 `3`이다. 기존 admin/manager로 카카오 로그인 후 읽기 전용 관리 경로를 먼저 확인한다.
  - 변경 QA는 같은 기관·같은 부서의 전용 `user`를 초대해 초대 수락, 부서 변경 승인, 도서 대출/취소를 검증한다. Auth user를 실제 삭제하는 manager 탈퇴 승인 테스트는 별도 실행 승인 없이는 수행하지 않는다.
- [TODO/REMOTE QA] signed-in QA
  - invite-only, 부서 승인, 도서 원자 취소, 계정 삭제, 테넌트 경계, 카카오 OAuth의 로그인 상태 운영 QA가 남아 있다. 기존 계정에는 일반 `user`가 없으므로 변경 QA 전용 초대 계정이 필요하다.

### 2026-02-28
- [IN_PROGRESS] UI-001  
  - 관리 리스트 UI 공통화 작업 재개.  
  - 현재 사용자 피드백 기준: 라인 구분 강화, 액션 컬럼 정렬, 불필요 여백 축소가 핵심.
- [IN_PROGRESS] UI-001 (2차 반영)  
  - 공통 리스트 행 패딩/헤더 패딩 축소 (`.module-list .list-row`, `.list-row-muted`)로 행간 여백을 줄이고 라인 구분을 강화.  
  - `ApprovalPolicyManager`의 데스크톱 컬럼 규칙을 `xl` 기준으로 재조정해 삭제 버튼 잘림 가능성을 해소.  
  - `UserRoleManager`(대기 초대/부서변경 요청/탈퇴 요청/미승인 사용자/등록 사용자) 액션 컬럼을 반응형으로 재정렬해 중간 해상도 깨짐을 완화.  
  - 관련 파일 ESLint 검증 완료(오류 0).
- [IN_PROGRESS] UI-001 (3차 반영)  
  - 고정폭 우측 액션 컬럼 적용 시점을 일괄 상향(`md -> lg`)해 중간 해상도에서 행 깨짐/버튼 밀림을 방지.  
  - 적용 대상: `ReservationManager`, `AssetTransferRequestsBoard`, `AssetTransferRequestsPanel`, `AssetAdminPanel`, `DepartmentManager`, `FeedbackList`.  
  - `ApprovalPolicyManager` 액션 열 폭을 `3rem -> 3.5rem`으로 조정해 삭제 버튼 잘림 여유 확보.  
  - 관련 파일 ESLint 검증 완료(오류 0).
- [IN_PROGRESS] UI-002  
  - 예약승인 달력 데이터셋을 `reservations` 기준에서 `filteredReservations` 기준으로 통일해 목록/달력 불일치 경로 제거.  
  - 날짜 파싱 보강: `start_date`/`end_date`에 `~` 포함 단일 문자열이 들어오는 경우 후보를 분해/정렬해 기간을 복원하는 fallback 추가.  
  - 반영 파일: `ReservationManager.tsx`, `SpaceReservationManager.tsx`, `VehicleReservationManager.tsx`, `reservation-manager-shared.ts`.  
  - 검증: `npm run lint -- src/components/manage/reservation-manager-shared.ts src/components/manage/ReservationManager.tsx src/components/manage/SpaceReservationManager.tsx src/components/manage/VehicleReservationManager.tsx` (오류 0).  
  - 남은 확인: 실데이터 기준 월간 셀 이벤트/팝오버 표시 수동 QA 후 `DONE` 전환.
- [DONE] UI-002 (2차 반영 + 검증)  
  - 원인 확인: 달력 렌더 데이터는 `filteredReservations`로 맞췄지만, 달력 기준 월 결정(`calendarCurrentDate`)과 달력 클릭 상세 매핑은 원본 `reservations`를 사용해 필터 조건에서 체감 불일치 가능성이 남아있었음.  
  - 조치: 3개 예약 매니저(`물품/공간/차량`)의 달력 기준 월 계산/상세 매핑 모두 `filteredReservations` 기준으로 정렬.  
  - 달력 이벤트 최소정보: 월/주/일 이벤트 카드에 리소스명 + 상태 라벨을 함께 노출하도록 보강.  
  - 팝오버 최소정보: 리소스/상태/기간/신청자 정보 유지, 신청자 문자열 줄바꿈 안전 처리(`break-all`) 적용.  
  - 반영 파일: `ReservationManager.tsx`, `SpaceReservationManager.tsx`, `VehicleReservationManager.tsx`, `ReservationCalendarView.tsx`.  
  - 검증:  
    - `npm run lint -- src/components/manage/ReservationManager.tsx src/components/manage/SpaceReservationManager.tsx src/components/manage/VehicleReservationManager.tsx src/components/manage/ReservationCalendarView.tsx src/components/manage/reservation-manager-shared.ts` (오류 0)  
    - `npm run lint:mobile` (통과)
- [DONE] UI-001 (4차 마무리 점검)  
  - 예약승인 공간/차량 리스트의 고정 우측 컬럼 적용 시점을 `md -> lg`로 통일해 중간 해상도 오버플로우 리스크 제거.  
  - 달력 상세 팝오버 폭을 반응형(`w-[calc(100vw-24px)] max-w-[280px]`)으로 조정해 모바일 고정폭 경고 제거.  
  - 반영 파일: `SpaceReservationManager.tsx`, `VehicleReservationManager.tsx`, `ReservationCalendarView.tsx`.  
  - 검증: `npm run lint:mobile` (통과)
- [DONE] 공정 전환  
  - 문서 기반 실행 방식 도입.  
  - 앞으로 모든 변경은 본 문서 갱신을 선행/동반한다.
- [DONE] OAuth 프리뷰 로그인 안정화
  - 원인 확인: 카카오 OAuth는 허용 Redirect URI 기반인데, Vercel 커밋 단위 프리뷰 URL이 배포마다 바뀌어 프리뷰 로그인 실패 발생.
  - 조치: `middleware.ts`에 프리뷰 호스트 정규화 추가.
    - 우선순위: `NEXT_PUBLIC_CANONICAL_PREVIEW_HOST` -> `VERCEL_BRANCH_URL`
    - 현재 호스트가 `.vercel.app` 랜덤 프리뷰이고 정규화 대상 호스트가 있으면 307 리다이렉트
  - 문서 갱신: `docs/kakao_oauth_setup.md`, `docs/vercel_deployment_guide.md`에 브랜치 고정 URL 등록 절차 추가.
  - 검증: `npm run lint -- src/middleware.ts` (오류 0)
- [DONE] OAuth redirect origin 고정값 지원
  - 조치: `getOAuthOrigin()` 추가(`NEXT_PUBLIC_OAUTH_REDIRECT_ORIGIN` 우선), 카카오 로그인 호출부(`AuthCard`, `join`)에 적용.
  - 목적: 프리뷰/운영에서 OAuth `redirectTo`를 환경별 고정 도메인으로 강제해 리다이렉트 불일치 리스크를 낮춤.
  - 문서 갱신: `README.md`, `docs/kakao_oauth_setup.md`, `docs/vercel_deployment_guide.md`.
  - 검증: `npm run lint -- src/lib/utils.ts src/components/auth/AuthCard.tsx src/app/join/page.tsx` (오류 0)
- [DONE] OAuth origin 우선순위 보정 (git-main -> production 강제 이동 회귀 수정)
  - 증상: `git-main` alias에서 카카오 로그인 시 production 도메인으로 이동.
  - 원인: `getOAuthOrigin()`이 환경변수 원본을 무조건 우선해 현재 안정 호스트를 덮어씀.
  - 조치: 안정 호스트는 `window.location.origin` 우선, 커밋 프리뷰 호스트 패턴에서만 환경변수 정규화 적용.
  - 검증: `npm run lint -- src/lib/utils.ts` (오류 0)
- [DONE] 사용자 관리 3건 후속 보정
  - `만료일 저장` 버튼 폭 보정: `shrink-0 + whitespace-nowrap + min-width` 적용으로 텍스트 세로 줄바꿈 방지.
  - 기관 생성/이관 경로 보강:
    - `UserRoleManager`에 "새 기관 추가" 인라인 생성 UI 추가.
    - `OrganizationManager`(기관 관리 메뉴)에 "신규 기관 추가 생성" 섹션 추가.
    - 기관/부서 조회 및 사용자 기관 지정/이관은 서버 액션(service role) 경유로 처리해 RLS 조회 제한 영향 제거.
  - 등록 사용자 정렬 보정: `본인 우선 + 이름 오름차순`으로 렌더 순서 고정.
  - 검증:
    - `npm run lint -- src/actions/admin-organization-actions.ts src/components/settings/UserRoleManager.tsx src/components/settings/OrganizationManager.tsx` (오류 0)
    - `npm run lint:mobile` (통과)
- [DONE] 리스트 가로 구분선 스타일 통일
  - 요청: "기능 및 메뉴 설정" 리스트처럼 항목별 가로선 구분을 다른 리스트에도 일관 적용.
  - 조치: `module-list` 공통 스타일을 행 사이 divider 기반으로 보강(인셋 가로선 + 외곽선 톤 통일).
  - 반영 파일: `src/app/globals.css`
  - 검증: `npm run lint:mobile` (통과)
- [DONE] 부서 목록 리스트 divider 가시성 강화
  - 요청: 부서 목록도 기능/메뉴 리스트처럼 행 구분선을 명확히 표시.
  - 조치: `DepartmentManager`에 전용 클래스(`module-list-departments`) 적용, divider 톤/인셋을 강화.
  - 반영 파일: `src/components/settings/DepartmentManager.tsx`, `src/app/globals.css`
  - 검증: `npm run lint -- src/components/settings/DepartmentManager.tsx`, `npm run lint:mobile` (통과)
- [DONE] 승인정책 리스트 divider 가시성 강화
  - 요청: 승인정책 리스트도 기능/메뉴 리스트처럼 행 구분선 강화.
  - 조치: `ApprovalPolicyManager`에 전용 클래스(`module-list-approvals`) 적용, divider 톤/인셋 강화.
  - 반영 파일: `src/components/settings/ApprovalPolicyManager.tsx`, `src/app/globals.css`
  - 검증: `npm run lint -- src/components/settings/ApprovalPolicyManager.tsx`, `npm run lint:mobile` (통과)
- [DONE] 자원관리(물품/공간/차량) 리스트 구분선 일관화 + 도서 관리 기본 화면 전환
  - 요청:
    1. 물품/공간/차량 리스트를 동일한 가로 divider 패턴으로 통일.
    2. 도서는 기본 진입 시 등록 폼이 아닌 "등록된 도서 목록"을 먼저 노출하고, `도서 등록` 클릭 시 ISBN 등록 폼으로 전환.
  - 조치:
    1. `module-list-resources` 스타일을 추가해 자원관리 리스트 divider를 동일 톤/인셋으로 통일.
    2. `SpaceAdminPanel`/`VehicleAdminPanel`을 `module-list` 구조로 변경(헤더 행 + 전체선택 + 행 divider).
    3. `BooksManagePage`에 등록 도서 목록 조회/필터 상태를 추가하고, `register` 탭을 "도서 목록" UX로 재구성(토글형 `도서 등록` 버튼).
  - 반영 파일: `src/app/globals.css`, `src/components/manage/AssetAdminPanel.tsx`, `src/components/manage/SpaceAdminPanel.tsx`, `src/components/manage/VehicleAdminPanel.tsx`, `src/app/books/manage/page.tsx`
  - 검증:
    - `npm run lint` (통과)
    - `npm run build` (실패: sandbox 네트워크 제한으로 Google Fonts(`Geist`, `Geist Mono`) fetch 불가)
- [DONE] UI 표준화 1차 (관리페이지 공통 컴포넌트 변환)
  - 범위: `물품/공간/차량` 관리 화면의 반복 UI를 공통 컴포넌트로 추출해 일관성 확보.
  - 조치:
    1. `ManageFilterToolbar`: 건수/새로고침/검색/상태필터 영역 공통화.
    2. `ManageBulkStatusBar`: 선택 항목 일괄 상태 변경 바 공통화.
    3. `ManageResourceList`: 헤더/전체선택/행 영역 리스트 프레임 공통화.
    4. `AssetAdminPanel`, `SpaceAdminPanel`, `VehicleAdminPanel`에 위 컴포넌트 적용.
  - 반영 파일:
    - `src/components/manage/ManageFilterToolbar.tsx`
    - `src/components/manage/ManageBulkStatusBar.tsx`
    - `src/components/manage/ManageResourceList.tsx`
    - `src/components/manage/AssetAdminPanel.tsx`
    - `src/components/manage/SpaceAdminPanel.tsx`
    - `src/components/manage/VehicleAdminPanel.tsx`
  - 검증: `npm run lint` (통과)
- [DONE] UI 표준화 2차 (설정 리스트 공통 프레임 도입)
  - 범위: 설정 페이지 리스트(`부서 목록`, `승인정책`, `등록된 사용자`)의 래퍼/헤더 구조 통일.
  - 조치:
    1. `ModuleList`, `ModuleListHeader` 공통 컴포넌트 추가.
    2. `DepartmentManager` 부서 목록을 공통 프레임으로 전환.
    3. `ApprovalPolicyManager` 정책 목록 래퍼를 공통 프레임으로 전환.
    4. `UserRoleManager` 등록된 사용자 리스트 헤더/래퍼를 공통 프레임으로 전환.
  - 반영 파일:
    - `src/components/ui/ModuleList.tsx`
    - `src/components/settings/DepartmentManager.tsx`
    - `src/components/settings/ApprovalPolicyManager.tsx`
    - `src/components/settings/UserRoleManager.tsx`
  - 검증: `npm run lint` (통과)
- [DONE] 등록된 사용자 리스트 1행 정렬 보정
  - 요청: 사용자 섹션의 중복 인지 요소를 줄이고, 다른 리스트처럼 행 단위 스캔이 되도록 1행 레이아웃으로 정렬.
  - 조치: `UserRoleManager` 등록 사용자 행에서 우측 컨트롤 영역을 `nowrap + 고정폭`으로 조정해 데스크톱에서 한 줄 정렬을 강제.
  - 반영 파일: `src/components/settings/UserRoleManager.tsx`
  - 검증: `npm run lint -- src/components/settings/UserRoleManager.tsx` (통과)
- [DONE] 부서 목록/승인정책 데스크톱 1행 정렬 보정
  - 요청: `부서 목록`, `승인정책 관리`도 사용자 리스트와 같은 수준의 1행 스캔 구조로 정리.
  - 조치:
    1. `DepartmentManager` 리스트 헤더/행 grid 적용 시점을 `lg -> md`로 조정하고 액션 컬럼 우측 정렬 고정.
    2. `ApprovalPolicyManager` 정책 리스트를 `md` 기준 3열(`정책/권한/관리`) 1행 정렬로 전환.
    3. 승인정책 행의 중복 문구(`승인 권한: ...`) 제거.
  - 반영 파일:
    - `src/components/settings/DepartmentManager.tsx`
    - `src/components/settings/ApprovalPolicyManager.tsx`
  - 검증: `npm run lint -- src/components/settings/DepartmentManager.tsx src/components/settings/ApprovalPolicyManager.tsx` (통과)
- [DONE] 프로덕션 OAuth 로그인 오류 대응 (콜백 안정화)
  - 증상: production 로그인 완료 후 `/login?error=오류가 발생했습니다`로 귀결되어 로그인 실패.
  - 원인 추정: `detectSessionInUrl` 자동 code 교환과 콜백의 수동 `exchangeCodeForSession` 호출이 경합하면서 `flow_state_not_found`가 발생하고 일반 오류로 처리됨.
  - 조치:
    1. 콜백에서 `code` 수신 시 자동 세션 확정을 먼저 대기하고, 수동 `exchangeCodeForSession`은 fallback으로만 호출.
    2. 콜백 페이지에서 query/hash `error` 파라미터를 우선 해석하고, 세션만료/취소/일반실패를 구분해 메시지 표준화.
    3. `exchangeCodeForSession` 예외 throw 케이스를 별도 포착해 recoverable 재시도 후 메시지 기반 리다이렉트 처리.
  - 반영 파일:
    - `src/app/auth/callback/page.tsx`
  - 검증: `npm run lint -- src/app/auth/callback/page.tsx` (통과)
- [DONE] 예약신청 시작/종료일시 역제약 수정
  - 증상: 시작일시가 종료일시 기본값에 의해 제한되어 다음 달(예: 3월) 선택이 불가능한 경우가 발생.
  - 조치:
    1. 시작일시 input의 `max=endDate` 제약 제거(시작일시 독립 선택).
    2. 종료일시 기본값 제거(`endDate`, `endTime` 초기값 빈값).
    3. 종료일시는 시작일시 이후만 선택되도록 `min=startDate` 유지 + 시작일 변경 시 기존 종료일이 더 이르면 종료값 초기화.
    4. 종료 hidden 필드는 날짜/시간이 모두 선택된 경우에만 직렬화.
  - 반영 파일:
    - `src/components/assets/ReservationForm.tsx`
  - 검증: `npm run lint -- src/components/assets/ReservationForm.tsx` (통과)

## 3) 이슈 / RCA 로그

### RCA-2026-08-24-01
- 증상/감사 결과:
  1. service-role 계정 삭제 액션에 호출자 인증/권한 검증이 없었다.
  2. 조직 `role='admin'`만으로 전역 기관/사용자 관리가 가능했고, 일부 RLS 정책도 조직 admin과 플랫폼 admin을 구분하지 않았다.
  3. anon invite 테이블 직접 조회와 OAuth 외부 `next` 리다이렉트 경로가 남아 있었다.
- 원인:
  1. 클라이언트 UI 권한 검사를 서버 신뢰 경계로 간주했다.
  2. 플랫폼 관리자 모델/서버 allowlist 없이 service-role을 전역 관리 편의에 사용했다.
  3. 초기 RLS 보정 migration이 누적되며 최종 테넌트 경계가 명시적으로 고정되지 않았다.
- 조치:
  1. 인증 사용자/대상 프로필을 서버에서 재검증하고 동일 기관 경계를 강제했다.
  2. 전역 작업은 `PLATFORM_ADMIN_USER_IDS` allowlist가 있는 서버 액션으로만 허용했다.
  3. 계정 삭제 승인은 operation claim/finalize/rollback과 identity snapshot으로 보상 가능하게 만들고, 마지막 admin은 조직 행 잠금 DB trigger 불변식으로 보호했다.
  4. RLS hardening migration과 OAuth redirect sanitizer/test를 추가했다.
- 재발 방지:
  1. service-role 액션마다 `인증 -> actor role -> actor tenant -> target tenant` 검증 순서를 적용한다.
  2. 조직 admin을 플랫폼 admin으로 해석하지 않는다.
  3. 배포 전 백업과 정책 assertion, 배포 후 signed-in 회귀 QA를 필수화한다.
- 잔여 위험:
  - 위 조치는 현재 로컬 변경이다. 프로덕션 코드 배포와 원격 RLS migration 적용 전까지 원격 동작은 기존 상태다.
  - 일반 user를 admin이 직접 삭제하는 Auth 외부 호출에는 actor 강등/target tenant 이동의 짧은 TOCTOU가 남는다. 완전 제거에는 DB deletion authorization marker/RPC가 필요하다.

### RCA-2026-08-24-02
- 증상/감사 결과:
  1. 초대 없이 프로필을 만드는 공개 가입 신청 경로와 가입자가 부서를 선택하는 UI가 남아 있었다.
  2. 부서 변경 승인이 클라이언트 다단계 갱신에 의존했고, 요청 상태 도서 취소도 대출/도서 상태를 별도 쿼리로 변경했다.
- 원인:
  1. 초대 레코드의 role/department보다 브라우저 입력과 UI 권한을 일부 신뢰했다.
  2. 권한 변경 및 연관 상태 변경이 서버 검증과 원자 트랜잭션 경계에 완전히 포함되지 않았다.
- 조치:
  1. 제품을 invite-only로 고정하고 초대 이메일/일회성 사용/서버 확정 role·department를 강제했다. 초대 생성은 호출자 기관으로 고정하고 manager는 자기 담당 부서의 manager/user 초대만 허용했다.
  2. 부서 변경 승인을 tenant-bound 서버 액션으로 이동하고 실패 시 보상 복구를 추가했다.
  3. 도서 신청 취소용 원자 RPC를 migration에 추가하고 API는 RPC 미존재 환경에서만 보상 가능한 fallback을 사용한다.
- 재발 방지:
  1. 조직/권한 부여 값은 URL 또는 브라우저 form 값이 아니라 서버가 재조회한 승인 레코드에서 결정한다.
  2. 둘 이상의 연관 행을 바꾸는 상태 전이는 DB 함수/트랜잭션을 우선하며, 호환 경로에는 조건부 갱신과 보상 절차를 둔다.
- 잔여 위험:
  - 코드와 migration은 로컬 상태다. 원격 배포/RLS 적용 전 사용자 확인과 Free 플랜 수동 백업이 필요하다.

### RCA-2026-02-28-01
- 증상: 대화가 길어지면 컨텍스트 압축 이후 진행 맥락이 약해져 반복 확인/재작업 발생.
- 원인:
  1. 작업 목록과 완료 기준이 채팅 흐름에만 존재해 영속성이 낮음.
  2. 실패/회귀 원인 기록이 코드/문서에 구조화되지 않음.
- 조치:
  1. 본 문서를 단일 실행 기준 문서로 지정.
  2. 각 작업을 ID/상태/AC/관련파일 단위로 관리.
  3. 이슈 발생 시 RCA 항목을 강제 기록.
- 재발 방지:
  1. 새 세션 시작 시 본 문서 선조회.
  2. 커밋 전 `작업 상태 + 로그 + RCA(해당 시)` 갱신 체크.
  3. 미기록 작업은 진행하지 않는 규칙 적용.

### RCA-2026-02-28-02
- 증상: 승인정책/사용자관리 리스트에서 우측 삭제/액션 버튼이 일부 해상도에서 잘리거나 붙어서 보임.
- 원인:
  1. `md`~`lg` 폭에서 고정 폭 컬럼(`320px`, `360px`, `20rem`)이 너무 일찍 적용됨.
  2. 리스트 래퍼가 `overflow-hidden`인 상태에서 행 내부 폭이 커지면 우측 액션이 시각적으로 잘림.
- 조치:
  1. 고정 폭 그리드 전환 시점을 `md`에서 `lg`/`xl`로 상향.
  2. 액션 영역을 `w-full -> lg/xl 고정폭` 형태로 재정의하여 좁은 폭에서는 자연스럽게 줄바꿈.
  3. 공통 리스트 패딩을 축소해 유효 콘텐츠 폭 확보.
- 재발 방지:
  1. 리스트형 화면 신규/수정 시 `1024px, 1280px` 해상도에서 액션 열 가시성 체크를 릴리즈 체크리스트에 포함.
  2. 고정폭 액션 컬럼은 `lg/xl`부터만 적용하고, `md`에서는 스택 레이아웃을 기본으로 사용.

### RCA-2026-02-28-03
- 증상: 예약승인에서 목록 모드에는 데이터가 보이지만 달력 모드에서는 일정이 비어 보임.
- 원인:
  1. 달력용 배열이 필터 적용 전 원본 배열을 사용해 목록과 기준이 달라짐.
  2. 일부 데이터에서 `start_date`/`end_date` 포맷이 비정형(range 단일 문자열)이라 기간 파싱 실패 후 달력 배치에서 제외됨.
  3. 달력 기준 월 계산/클릭 상세 매핑 경로가 원본 `reservations`를 참조해 필터 조건과 어긋날 여지가 있었음.
- 조치:
  1. 예약승인 3개 매니저(`물품/공간/차량`)의 `calendarReservations` 기준을 `filteredReservations`로 통일.
  2. `parseReservationDateRange`에 후보 분해 fallback(`~` 분리 후 정렬) 추가.
  3. `calendarCurrentDate`와 `onReservationClick` 상세 조회 경로도 `filteredReservations` 기준으로 정렬.
  4. 월/주/일 이벤트 카드에 상태 라벨을 함께 노출하고 팝오버 신청자 필드를 안전 줄바꿈 처리.
- 재발 방지:
  1. 예약 목록/달력의 데이터 소스는 동일 변수(`filteredReservations`)를 표준으로 사용.
  2. 날짜 파싱 함수 변경 시 비정형 샘플(`range string`, `date only`, `ko locale`) 회귀 케이스를 최소 1회 포함.
  3. 달력 관련 파생값(`calendarCurrentDate`, 상세 매핑)도 동일 데이터 소스를 사용하도록 코드리뷰 체크리스트에 추가.

### RCA-2026-02-28-04
- 증상: 프리뷰 사이트에서 카카오 로그인이 실패함.
- 원인:
  1. 카카오 Redirect URI 허용 목록은 고정 URL 기준.
  2. Vercel 커밋 단위 프리뷰 URL은 배포마다 호스트가 바뀌어 허용 목록과 불일치.
- 조치:
  1. 미들웨어에서 프리뷰 랜덤 호스트를 브랜치 고정 호스트(`VERCEL_BRANCH_URL` 또는 `NEXT_PUBLIC_CANONICAL_PREVIEW_HOST`)로 307 리다이렉트.
  2. 카카오/Supabase 설정 문서에 브랜치 고정 URL 등록 절차 명시.
- 재발 방지:
  1. OAuth 테스트는 커밋 URL 대신 브랜치 고정 URL/스테이징 도메인만 사용.
  2. 새 배포 환경 추가 시 카카오 + Supabase Redirect URI를 같은 기준 URL로 동시 등록.

### RCA-2026-02-28-05
- 증상: 브랜치 고정 프리뷰(`git-main`)에서 카카오 로그인 후 production 도메인으로 리다이렉트됨.
- 원인:
  1. OAuth 원본 계산이 환경변수 우선으로 고정되어 현재 요청 origin이 무시됨.
- 조치:
  1. `getOAuthOrigin()`에서 안정 호스트는 현재 origin 우선 사용.
  2. 커밋 프리뷰 호스트(`*-<hash>-*.vercel.app`)에서만 환경변수 기반 canonical origin을 사용.
- 재발 방지:
  1. OAuth origin 결정 로직 변경 시 `production / git-main / commit preview` 3개 케이스 회귀 테스트 포함.

### RCA-2026-02-28-06
- 증상:
  1. `만료일 저장` 버튼이 좁은 폭에서 글자 단위 줄바꿈으로 깨짐.
  2. 기관 관리 메뉴에서 신규 기관 추가 경로가 없어 사용자 기관 이관 준비가 막힘.
  3. 등록 사용자 리스트 정렬이 생성일 기반으로 체감상 불규칙하게 보임.
- 원인:
  1. `.btn-outline` 버튼에 nowrap 보장이 없어 flex 수축 시 텍스트 줄바꿈 발생.
  2. 클라이언트 RLS 조회 기준(본인 소속 기관)으로 기관/부서 목록이 제한되어 교차 기관 이관 플로우가 취약.
  3. 운영자 기대와 다른 정렬 기준(`created_at ASC`)이 계속 유지됨.
- 조치:
  1. 대상 버튼에 `shrink-0/whitespace-nowrap/min-width` 적용.
  2. 관리자 서버 액션으로 기관/부서 목록 조회, 기관 생성, 사용자 기관 지정/이관 수행.
  3. 등록 사용자 렌더 순서를 `본인 우선 + 이름 오름차순`으로 변경.
- 재발 방지:
  1. 관리자 교차-기관 기능은 클라이언트 직접 쿼리 대신 서버 액션 경로를 기본값으로 유지.
  2. 리스트 정렬 기준은 UI 텍스트와 동일하게 명시하고 변경 시 문서/QA 항목 동시 갱신.

### RCA-2026-02-28-07
- 증상: 관리형 리스트에서 항목 구분이 약해 스캔 속도/가독성이 떨어짐.
- 원인:
  1. 카드 경계/여백 위주 표현으로 행 단위 분리 인지가 화면마다 달랐음.
- 조치:
  1. `module-list` 공통 스타일에 행 사이 인셋 가로 divider를 적용.
  2. 외곽 border 톤을 리스트 패턴과 맞춰 통일.
- 재발 방지:
  1. 신규 리스트 UI는 `module-list` 공통 primitive 사용을 기본값으로 강제.

### RCA-2026-02-28-08
- 증상: 부서 목록에서 항목 경계선이 약해 드래그/편집 대상 구분이 어렵게 보임.
- 원인:
  1. 부서 목록은 텍스트 + 핸들 + 액션 아이콘 밀도가 높아 일반 divider 대비 시인성이 부족했음.
- 조치:
  1. 부서 목록 전용 divider 변형(`module-list-departments`)을 도입해 구분선을 강화.
- 재발 방지:
  1. 조작 UI(드래그/액션) 포함 리스트는 공통 divider 대비를 별도 점검해 필요 시 변형 클래스를 사용.

### RCA-2026-02-28-09
- 증상: 승인정책 목록에서 항목 사이 경계 인지가 약함.
- 원인:
  1. 정책 리스트도 액션/선택 컨트롤이 포함된 세로 밀집형 구조라 기본 divider 대비가 약했음.
- 조치:
  1. 승인정책 목록 전용 divider 변형(`module-list-approvals`)을 추가 적용.
- 재발 방지:
  1. 정책/승인/권한 계열 리스트는 공통 `module-list` 적용 후 divider 대비를 별도 QA 체크.

### RCA-2026-02-28-10
- 증상:
  1. 자원관리(공간/차량) 리스트가 카드형 간격 위주로 보여 행 단위 스캔이 약함.
  2. 도서 관리 진입 시 즉시 등록 폼이 열려, 기존 등록 도서 확인 동선이 끊김.
- 원인:
  1. 공간/차량 패널은 `module-list`가 아닌 `space-y` 블록을 사용해 divider 패턴이 적용되지 않았음.
  2. 도서 관리 `register` 탭이 "목록 + 등록 전환"이 아닌 "등록 폼 고정"으로 설계되어 있었음.
- 조치:
  1. 공간/차량 패널 구조를 `module-list` 기반으로 교체하고, 자원관리 전용 divider 클래스로 시각 밀도를 맞춤.
  2. 도서 관리에 등록 도서 목록 쿼리/필터를 추가하고, 버튼 기반 폼 전환 UX로 변경.
- 재발 방지:
  1. 관리형 리스트 신규 구현 시 `module-list` primitive 사용 여부를 PR 체크리스트에 포함.
  2. "등록" 탭은 기본 목록 노출 후 액션으로 입력 폼을 여는 패턴을 기본값으로 채택.

### RCA-2026-02-28-11
- 증상: 카카오 OAuth 콜백에서 간헐적으로 일반 오류(`/login?error=오류가 발생했습니다`)로 귀결되어 실제 원인 파악과 사용자 재시도 동선이 막힘.
- 원인:
  1. 콜백 로직이 `exchangeCodeForSession`의 throw 케이스를 일반 예외로 처리해 원인별 분기(세션 만료/취소/재시도)를 수행하지 못함.
  2. `detectSessionInUrl` 자동 교환이 진행 중인 시점에 수동 code 교환을 즉시 재호출하면 `flow_state_not_found`가 발생할 수 있음.
- 조치:
  1. `code` 콜백에서는 자동 세션 교환 완료를 먼저 대기하고, 수동 교환은 fallback으로만 호출해 이중 교환 경합을 차단.
  2. 콜백에서 `query/hash error`를 우선 파싱하고 메시지 매핑(`세션 만료/로그인 취소/인증 실패`)을 적용.
  3. code 교환 예외는 recoverable 재시도 후 실패 시 원인별 메시지로 `/login` 리다이렉트.
- 재발 방지:
  1. OAuth 콜백 예외는 generic 문구를 금지하고, 최소 3분류(만료/취소/실패)로 매핑한다.
  2. OAuth 흐름 변경 시 production + preview + mobile 카카오(앱 전환) 시나리오를 릴리즈 체크리스트에 포함한다.

### RCA-2026-02-28-12
- 증상: 예약신청 시작일시를 변경할 때 종료일시 기본값이 상한(`max`)으로 작동해 원하는 월(예: 2026년 3월)을 선택하지 못함.
- 원인:
  1. 시작일시 input에 `max=endDate`를 적용해 종료일시 기본값이 시작일 선택 범위를 역으로 제한함.
  2. 종료일시를 초기값(당일 18:00)으로 강제해 사용자가 시작일만 먼저 고르기 어려웠음.
- 조치:
  1. 시작일시 `max` 제약을 제거하고 종료일시는 `min=startDate`만 유지.
  2. 종료일시 기본값을 제거하고 시작일시 변경 시 불가능해진 종료값을 초기화.
  3. 종료 날짜/시간 모두 선택됐을 때만 `end_date` hidden 값을 생성.
- 재발 방지:
  1. 시작/종료 페어 입력은 `start=max(end)` 형태의 역제약을 금지하고 `end>=start` 단방향 제약만 사용.
  2. 기본값이 있는 필드는 다른 필드 선택 범위에 영향을 주는지 QA 체크리스트에 포함.

## 4) 다음 실행 순서
1. [완료] Supabase Free 플랜용 수동 백업 생성 및 archive 판독 검증
2. [완료] 원격 작업 범위와 실행 시점 사용자 확인
3. [완료] Vercel production 배포 및 공개 smoke
4. [완료] `20260824090000_harden_tenant_rls_boundaries.sql` 원격 적용 및 정책/RPC assertion
5. 카카오 OAuth signed-in/재접속, invite-only, 부서 변경 승인, 도서 취소 플로우 실환경 QA
6. 현재 production 소스 release commit/push
7. 원격 migration history baseline reconciliation 및 복원 리허설
8. UI-004 범위 확정: 예약 워크스페이스 월간 단일화 여부 결정
