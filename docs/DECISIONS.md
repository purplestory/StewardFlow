# DECISIONS

프로젝트 의사결정 로그 (변경 시 계속 추가)

## 2026-08-25
- 상태: 확정 (post-hardening ACL-inclusive DB recovery rehearsal, full application cutover 보류)
- 결정: current production snapshot은 custom archive로 보존하고, NAS에서는 Realtime runtime role을 먼저 초기화한 뒤 archive pre-data/data/post-data를 staged restore한다. blank DB의 GraphQL wrapper 순서 의존성은 archive TOC `5260`을 제외하고 production-equivalent prelude와 동일 ACL을 적용해 해결한다. `--no-privileges` restore 뒤 hardening reapply는 DB-only 진단 경로일 뿐 authoritative ACL recovery proof로 사용하지 않는다.
- 이유: DB-only target은 `supabase_realtime_admin` 역할이 없어 ACL restore가 중단되고, blank DB는 GraphQL event trigger가 해당 ACL보다 뒤에 복원된다. staged r3 restore는 이 두 runtime/ordering 조건을 명시적으로 충족하면서 원본 archive와 production history를 변경하지 않는다.
- 영향: fresh post-hardening snapshot의 데이터, schema, RLS, ACL, Realtime runtime role이 검증됐다. security postcheck와 233-entry normalized catalog hash가 원본과 일치한다. Storage object 바이너리, Edge Function secrets, SMTP/OAuth 및 외부 Auth/Storage 기능 cutover는 포함하지 않는다.
- 후속 결정: `docs/recovery_baseline.md`를 기준으로 canonical baseline/squash 전략과 production migration history metadata 변경 여부만 별도 승인한다. NAS 전체 서비스 networking/firewall 변경은 필요 시 별도 승인한다.

## 2026-08-24
- 상태: 확정 (격리 복원 리허설, 운영 전환 아님)
- 결정: NAS에서 `supabase/postgres:17.6.1.136` 기반의 별도 `steward-flow-restore-20260824` DB-only Supabase 복원 환경을 사용한다. 이 환경은 전용 네트워크·볼륨과 NAS loopback 전용 포트만 사용하며, Vercel production, 카카오 OAuth, 운영 Supabase URL과 연결하지 않는다.
- 이유: 실제 운영 backup의 Postgres 17/Supabase 확장 호환성을 먼저 검증하면서 기존 NAS Supabase 스택 및 공개 서비스에 영향을 주지 않기 위함이다.
- 영향: hardening 전 custom-format backup은 `supabase_admin`으로 새 빈 DB에 성공적으로 복원됐고, 그 복제 DB에서 hardening migration과 RLS/service-only RPC/FK postcheck도 통과했다. 이 결과는 DB-level rehearsal이며 Storage object 바이너리, Edge Function secrets, SMTP/OAuth 설정, 운영 cutover를 포함하지 않는다.
- 후속 결정: hardening 후 새 backup을 같은 격리 환경에서 복원·검증하고, 그 산출물을 기준으로 migration history baseline 전략과 전체 self-hosted Supabase 전환 범위를 별도 승인한다.

## 2026-08-24
- 상태: 운영 반영 및 소스 보존 완료 (후속 QA/복구 검증 대기)
- 결정: Vercel 프로덕션 `dpl_Ftp6DqqicKEhPBp8DtZuraiCaWMS`와 Supabase hardening migration `20260824090000_harden_tenant_rls_boundaries.sql`을 사전 DB 백업 및 배포 파일 dry-run 검증 후 적용했다. 적용 후 19개 DB assertion, anon 초대 REST 차단(`401`, 0행), 비로그인 프로덕션 스모크 테스트를 통과했다
- 이유: 운영 반영 상태와 로컬 구현 상태를 분리해 기록하고, 민감한 로컬 백업/환경 파일이 배포 업로드 대상에서 제외됐음을 추적 가능하게 남기기 위함
- 영향: `https://steward-flow.vercel.app`, `.vercelignore`, `docs/EXECUTION_TRACKER.md`, `docs/DB_MIGRATION_STATUS.md`, `docs/PROJECT_STATE.md`, `docs/NEXT_TASKS.md`
- 후속 결정: 운영 소스는 `29da08a`로 `origin/main`에 보존했다. legacy migration 전체 replay/일괄 applied 처리는 금지하고, 새 post-hardening baseline과 격리된 restore/replay 검증 뒤에만 원격 migration history metadata를 정리한다.
- 남은 작업: signed-in 역할별 운영 QA, 수동 적용된 migration과 Supabase migration history의 OPS-004 기준선 정합화, 실제 복원 리허설

## 2026-08-24
- 상태: 확정 (로컬 구현, 프로덕션 미배포)
- 결정: Steward Flow 가입은 invite-only로 운영하고 공개 가입 신청 `/join-request`는 폐기해 `/join`으로 이동시킨다. 초대 수락 시 인증 이메일/일회성 claim/기존 기관 소속 여부를 서버에서 검증하며 role과 department는 초대 레코드 값으로만 확정한다. 조직 admin은 자기 기관에만 초대하고, 부서 manager는 자기 non-null 부서에 `manager`/`user`만 초대한다
- 이유: 공개 pending 사용자 승인과 클라이언트가 제출한 권한/부서 값에 의존하면 초대 정책을 우회하거나 권한이 잘못 부여될 수 있기 때문
- 영향: `src/app/join-request/page.tsx`, `src/app/join/page.tsx`, `src/actions/invite-actions.ts`, 초대/가입 실환경 QA

## 2026-08-24
- 상태: 확정 (로컬 구현 및 migration 작성, 프로덕션/원격 미적용)
- 결정: manager 계정 탈퇴 승인은 고유 operation ID로 `pending -> processing -> approved`를 claim/finalize한다. 동일 기관·동일 부서의 현재 user에게 manager 역할을 인계하고, Auth 삭제 확정 실패는 저장한 역할 revision으로 rollback하며 불명확 결과는 processing에 유지한다. 충돌은 `manual_review`로 보존하고 requester FK SET NULL과 immutable UUID snapshot으로 삭제 후 요청 이력을 남긴다. 마지막 admin 제거는 조직 행 잠금 기반 profile UPDATE/DELETE trigger를 최종 DB 불변식으로 둔다
- 이유: Auth Admin API와 public DB는 단일 트랜잭션이 아니며, 앱의 count 사전검사만으로는 부분 실패나 동시 admin 제거를 막을 수 없기 때문
- 영향: `src/actions/auth-actions.ts`, `src/components/settings/UserRoleManager.tsx`, `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql`, 계정 삭제 운영 QA

## 2026-08-24
- 상태: 확정 (로컬 구현, 프로덕션 미배포)
- 결정: 부서 변경 승인은 service-role 서버 액션에서 승인자 인증, 동일 기관, manager 담당 부서/대상 역할/자기 승인 금지, 목적 부서와 요청 최신 상태를 재검증하고 다단계 처리 실패 시 프로필 변경을 보상 복구한다
- 이유: 클라이언트 직접 승인 흐름은 RLS 변경에 취약하고 요청/프로필 중 하나만 갱신되는 부분 실패 및 테넌트 경계 우회 위험이 있기 때문
- 영향: `src/actions/admin-organization-actions.ts`, `src/components/settings/UserRoleManager.tsx`, 부서 변경 승인 회귀 테스트

## 2026-08-24
- 상태: 확정 (로컬 구현 및 migration 작성, 프로덕션/원격 미적용)
- 결정: 요청 상태 도서 대출 취소는 `cancel_requested_book_loan_atomic(uuid, uuid)` RPC를 우선 사용한다. 함수가 실제로 없는 pre-migration 환경에서만 사전 활성 대출 조회와 보상 복구가 있는 fallback을 허용하며, 승인 후 취소 요청은 동일 unread 알림이 있으면 멱등 응답한다
- 이유: 대출 상태와 도서 상태를 별도 쿼리로 변경할 때 부분 성공이 남을 수 있고, 반복 클릭으로 같은 취소 알림이 중복 생성될 수 있기 때문
- 영향: `src/app/api/reservations/my/route.ts`, `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql`, 도서 취소 운영 QA

## 2026-08-24
- 상태: 운영 원칙 확정 (실행 대기)
- 결정: Supabase Free 플랜에는 자동 백업이 없음을 전제로 RLS migration 전에 수동 백업 산출물과 복원 절차를 확보한다. 프로덕션 코드 배포와 원격 RLS 적용은 각 실행 명령 직전에 사용자에게 대상 환경/범위를 다시 확인한 뒤 수행한다
- 이유: 현재 원격 migration history가 로컬과 불일치하고 자동 복구 지점이 없는 상태에서 원격 변경을 선행하면 장애 복구가 어려워질 수 있기 때문
- 영향: `docs/DB_MIGRATION_STATUS.md`, 배포 체크리스트, Supabase/Vercel 운영 절차

## 2026-08-24
- 상태: 확정 (로컬 구현, 프로덕션 미배포)
- 결정: 플랫폼 전역 기관 관리는 서버 전용 `PLATFORM_ADMIN_USER_IDS` allowlist와 인증된 `role='admin'`을 모두 만족할 때만 허용한다. 일반 조직 admin의 service-role 액션은 자기 `organization_id` 범위로 제한한다
- 이유: 기존 `role='admin'`은 조직 역할인데도 플랫폼 역할처럼 해석되어 다른 조직 조회/생성/사용자 이관에 service-role을 사용할 수 있었기 때문
- 영향: `src/actions/admin-organization-actions.ts`, `UserRoleManager`, `OrganizationManager`, 운영 환경변수 관리
- 이전 결정과의 관계: 2026-02-28의 "기관 간 관리에 service-role 우선" 결정을 대체하며, service-role 사용 전 actor/tenant/platform allowlist 검증을 필수화한다

## 2026-08-24
- 상태: 확정 (migration 작성, 원격 미적용)
- 결정: RLS는 조직 admin/manager를 동일 테넌트에만 묶고, profile의 `role`/`organization_id` 등 privileged field는 RLS뿐 아니라 trigger로 보호한다
- 이유: 행 단위 UPDATE 정책만으로는 사용자가 자기 profile의 권한 컬럼을 바꾸는 것을 안전하게 막을 수 없고, 전역 admin 정책이 테넌트 경계를 약화했기 때문
- 영향: `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql`, profile/organization/account deletion/feedback 정책
- 배포 조건: 원격 백업 후 migration 적용, 정책 assertion 및 signed-in 테넌트 회귀 QA 필수

## 2026-08-24
- 상태: 확정 (migration 작성, 원격 미적용)
- 결정: anon은 `organization_invites` 테이블을 직접 SELECT하지 못하며, 공개 초대 token 조회/검증은 service-role 서버 액션에서 token을 명시적으로 검증하는 경로만 사용한다
- 이유: RLS SELECT 정책은 클라이언트 쿼리에 특정 token filter가 포함됐는지 증명할 수 없어 활성 초대 전체 노출 가능성을 제거할 수 없기 때문
- 영향: `organization_invites` grant/RLS, `getInviteByToken` 계열 서버 경로, 초대 수락 QA

## 2026-08-24
- 상태: 확정 (로컬 구현, 프로덕션 미배포)
- 결정: 내 신청 데이터 모델에 `book_loans`를 `resource_type='book'`으로 통합하고, 도서 상태를 공통 신청 상태로 정규화한다
- 이유: 물품/공간/차량과 도서 신청이 서로 다른 화면과 취소 규칙을 사용해 사용자가 자신의 전체 신청 상태를 한곳에서 확인할 수 없었기 때문
- 영향: `src/app/api/reservations/my/route.ts`, `src/hooks/useReservations.ts`, `src/components/my/ReservationsClient.tsx`, 도서 취소 알림

## 2026-08-24
- 상태: 확정 (로컬 구현, 프로덕션 미배포)
- 결정: 기관 삭제는 트랜잭션 RPC가 준비될 때까지 UI에서 실행하지 않고 운영자 문의 안내로 대체하며, authenticated 사용자의 DB 직접 DELETE 권한도 제거한다
- 이유: 멤버의 `organization_id` 해제와 기관 삭제를 클라이언트에서 순차 수행하면 중간 실패 시 부분 상태가 남고, 강화된 tenant trigger와도 충돌하기 때문
- 영향: `src/components/settings/OrganizationManager.tsx`, `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql`, 향후 운영자 전용 트랜잭션/RPC 과제

## 2026-08-24
- 상태: 확정 (로컬 구현, 프로덕션 미배포)
- 결정: Next.js 16의 요청 경계는 `proxy.ts`를 사용하고, `lint + mobile lint + typecheck + unit test + build`를 GitHub Actions 필수 quality gate로 운영한다
- 이유: deprecated middleware 경고, 테스트 부재, 의존성/빌드 회귀를 배포 전에 일관되게 차단하기 위함
- 영향: `src/proxy.ts`, `package.json`, `.github/workflows/quality.yml`, `src/lib/auth-redirect.test.ts`

## 2026-02-28
- 상태: 확정
- 결정: 자원관리(물품/공간/차량) 화면은 `ManageFilterToolbar` / `ManageBulkStatusBar` / `ManageResourceList` 공통 컴포넌트를 사용한다
- 이유: 동일한 UI 패턴(검색/필터/일괄변경/리스트 프레임)이 화면별로 중복 구현되어 시각/동작 일관성과 유지보수성이 떨어졌기 때문
- 영향: `AssetAdminPanel`, `SpaceAdminPanel`, `VehicleAdminPanel`, `src/components/manage/*` 공통 컴포넌트

## 2026-02-28
- 상태: 확정
- 결정: 예약신청 폼에서 `종료일시`는 기본값 없이 시작하고, 시작일시는 종료일시와 독립적으로 선택 가능하도록 `max` 제약을 제거한다. 종료일시는 시작일 이후(`min=startDate`)만 허용한다
- 이유: 종료 기본값이 시작일 선택 범위를 역으로 제한해 다음 달(예: 3월) 선택이 막히는 역제약 버그가 발생했기 때문
- 영향: `src/components/assets/ReservationForm.tsx` (시작/종료 초기값, 날짜 제약, 숨김 필드 직렬화, 요약 텍스트)

## 2026-02-28
- 상태: 확정
- 결정: 카카오 OAuth 콜백은 `detectSessionInUrl` 자동 code 교환 완료를 먼저 대기하고, 수동 `exchangeCodeForSession`은 fallback으로만 호출한다. 콜백 오류 메시지는 원인별(세션 만료/취소/인증 실패)로 매핑한다
- 이유: `flow_state_not_found`가 자동 교환 + 수동 교환의 경합(이중 교환)에서 발생해 일반 오류로만 귀결되던 문제를 줄이기 위함
- 영향: `src/app/auth/callback/page.tsx` (자동 세션 대기 후 fallback 교환, 쿼리/해시 오류 파싱, 예외 메시지 매핑)

## 2026-02-28
- 상태: 확정
- 결정: 설정 페이지 리스트(부서/승인정책/등록사용자)의 공통 래퍼는 `ModuleList` / `ModuleListHeader`로 표준화한다
- 이유: 섹션별 리스트 헤더/테두리/간격이 미세하게 달라 UI 일관성과 유지보수성이 떨어졌기 때문
- 영향: `DepartmentManager`, `ApprovalPolicyManager`, `UserRoleManager`, `src/components/ui/ModuleList.tsx`

## 2026-02-28
- 상태: 확정
- 결정: `등록된 사용자` 행은 데스크톱 기준 `사용자정보 + 부서 + 권한 + 삭제` 1행 정렬을 기본으로 하고, 현재 상태 중복 문구는 별도 노출하지 않는다
- 이유: 동일 정보가 텍스트와 드롭다운에 중복되어 스캔성이 떨어지고, 다른 리스트 패턴과 시각적 일관성이 깨졌기 때문
- 영향: `src/components/settings/UserRoleManager.tsx` 등록 사용자 행 레이아웃/폭 규칙

## 2026-02-28
- 상태: 확정
- 결정: `부서 목록`과 `승인정책` 리스트도 데스크톱에서 1행 스캔이 가능하도록 `md` 기준 grid 정렬을 사용하고, 승인정책 중복 상태 텍스트는 제거한다
- 이유: 섹션마다 행 밀도와 정보배치가 달라 같은 관리 화면에서도 스캔 비용이 달랐기 때문
- 영향: `src/components/settings/DepartmentManager.tsx`, `src/components/settings/ApprovalPolicyManager.tsx`

## 2026-02-28
- 상태: 확정
- 결정: 자원관리 리스트(물품/공간/차량)는 `module-list-resources` divider 변형을 공통 적용해 행 구분선을 동일 톤/인셋으로 맞춘다
- 이유: 자원 유형별 패널 구현 방식이 달라 같은 관리 페이지 내에서도 항목 경계 인지가 들쭉날쭉했기 때문
- 영향: `AssetAdminPanel`, `SpaceAdminPanel`, `VehicleAdminPanel`, `globals.css`

## 2026-02-28
- 상태: 확정
- 결정: 도서 관리 `register` 탭의 기본 화면은 "등록 도서 목록"으로 두고, `도서 등록` 버튼 클릭 시에만 ISBN 등록 폼으로 전환한다
- 이유: 즉시 입력 폼 노출보다 현재 등록 도서 파악이 운영 동선의 선행 단계이기 때문
- 영향: `src/app/books/manage/page.tsx` (탭 라벨/목록 조회/폼 토글 UX)

## 2026-02-28
- 상태: 확정
- 결정: 승인정책 목록(`ApprovalPolicyManager`)도 전용 divider 톤(`module-list-approvals`)으로 행 구분선을 강화한다
- 이유: 정책 항목이 긴 세로 리스트로 렌더될 때 항목 경계가 약해 스캔성이 떨어졌기 때문
- 영향: `ApprovalPolicyManager`, `globals.css` 리스트 스타일 변형

## 2026-02-28
- 상태: 확정
- 결정: 부서 목록(`DepartmentManager`)은 전용 divider 톤(`module-list-departments`)을 사용해 행 구분선을 한 단계 더 강조한다
- 이유: 드래그 핸들/액션 버튼이 함께 있는 리스트에서 항목 경계 인지가 일반 리스트보다 더 약하게 보였기 때문
- 영향: `DepartmentManager`, `globals.css` 리스트 스타일 변형

## 2026-02-28
- 상태: 확정
- 결정: 관리형 리스트(`module-list`)는 카드 분리 대신 공통 가로 구분선(행 사이 divider) 패턴을 기본으로 사용한다
- 이유: 화면마다 리스트 밀도/경계 인지가 달라 사용자가 항목 구분을 어렵게 느꼈기 때문
- 영향: `src/app/globals.css` (`module-list` 공통 스타일), 설정/관리 전반 리스트 가독성

## 2026-02-28
- 상태: 확정
- 결정: 기관 간 사용자 지정/이관 관련 읽기/쓰기(`organizations`, `departments`, `profiles update`)는 관리자 서버액션(service role) 경로를 우선 사용한다
- 이유: 클라이언트 RLS 정책(본인 소속 기관만 조회)으로 인해 신규 기관 생성 후 대상 기관/부서 선택이 막히는 문제가 반복되기 때문
- 영향: `src/actions/admin-organization-actions.ts`, `UserRoleManager`, `OrganizationManager`

## 2026-02-28
- 상태: 확정
- 결정: 등록된 사용자 리스트 기본 정렬은 `본인 우선 + 이름 오름차순`으로 고정한다
- 이유: 생성일 기준 정렬이 운영자가 기대하는 사용자 탐색 순서와 맞지 않아 체감 혼란이 커졌기 때문
- 영향: `UserRoleManager` 등록 사용자 렌더링 순서

## 2026-02-28
- 상태: 확정
- 결정: OAuth 원본 계산은 "안정 호스트(현재 origin) 우선, 커밋 프리뷰 호스트만 환경변수 기준으로 정규화"로 운영한다
- 이유: `git-main` 같은 브랜치 고정 alias에서도 production으로 강제 리다이렉트되는 부작용을 방지하기 위함
- 영향: `src/lib/utils.ts` (`getOAuthOrigin`)

## 2026-02-28
- 상태: 확정
- 결정: 카카오 OAuth `redirectTo` 원본은 `NEXT_PUBLIC_OAUTH_REDIRECT_ORIGIN`을 우선 사용한다
- 이유: 프리뷰 호스트 정규화 이전/이후 모두에서 OAuth 리다이렉트 도메인을 예측 가능하게 고정하기 위함
- 영향: `src/lib/utils.ts`, `AuthCard`, `join` 로그인 경로, Vercel 환경변수 운영 가이드

## 2026-02-28
- 상태: 확정
- 결정: Vercel 프리뷰의 OAuth 기준 호스트를 커밋 URL이 아닌 브랜치 고정 URL로 정규화한다
- 이유: 카카오 Redirect URI는 고정 허용 목록 기반이라 커밋마다 바뀌는 프리뷰 URL에서 로그인 실패가 반복되기 때문
- 영향: `middleware.ts`, 카카오/Supabase Redirect URL 운영 절차, 배포 가이드 문서

## 2026-02-28
- 상태: 확정
- 결정: 예약승인 달력의 파생 경로(`calendarCurrentDate`, 달력 클릭 상세 매핑)도 `filteredReservations` 기준으로 통일한다
- 이유: 렌더 데이터만 통일하면 필터 조건에서 달력 기준 월/상세 연동이 어긋나는 체감 불일치가 남기 때문
- 영향: `ReservationManager`, `SpaceReservationManager`, `VehicleReservationManager`

## 2026-02-28
- 상태: 확정
- 결정: 예약승인 달력 이벤트 최소정보는 "리소스명 + 상태 라벨", 팝오버 최소정보는 "리소스/상태/기간/신청자"로 고정한다
- 이유: 월/주/일 셀에서 식별 가능한 최소 정보를 유지하면서 상세 진입 전 판단 비용을 줄이기 위함
- 영향: `ReservationCalendarView`

## 2026-02-28
- 상태: 확정
- 결정: 장기 작업은 `docs/EXECUTION_TRACKER.md`를 단일 실행 기준 문서(작업목록/진행로그/RCA)로 운영
- 이유: 컨텍스트 압축 시 맥락 손실과 재작업을 줄이고, 원인 분석 및 재발방지 기록을 강제하기 위함
- 영향: 세션 재개 루틴, 커밋 전 문서 업데이트 절차, 이슈 대응 방식 전반

## 2026-02-28
- 상태: 확정
- 결정: 관리형 리스트의 고정폭 액션 컬럼은 `lg/xl` 이상에서만 적용하고, `md` 이하는 스택 레이아웃을 기본으로 사용
- 이유: 중간 해상도(`md~lg`)에서 우측 액션 버튼 잘림/겹침이 반복 발생했기 때문
- 영향: `ApprovalPolicyManager`, `UserRoleManager` 등 리스트 기반 관리 화면의 반응형 컬럼 규칙

## 2026-02-28
- 상태: 확정
- 결정: 예약승인 화면의 달력/목록 데이터 소스를 `filteredReservations`로 통일하고, 날짜 파싱은 range 단일 문자열(`~`) fallback을 포함한다
- 이유: 목록에는 보이는데 달력에는 비어 보이는 불일치와 비정형 날짜 포맷 파싱 실패를 동시에 방지하기 위함
- 영향: `ReservationManager`, `SpaceReservationManager`, `VehicleReservationManager`, `reservation-manager-shared`

## 2026-02-20
- 상태: 확정
- 결정: 카카오 OAuth 콜백에서 `code exchange` 오류 발생 시 세션 복구 대기 후 성공 리다이렉트 우선 처리
- 이유: 세션 확정 지연으로 인한 일시적 `/login?error=인증에 실패했습니다` 깜빡임을 줄이기 위함
- 영향: `/src/app/auth/callback/page.tsx` (`P0-3` 회귀 테스트 대상)

## 2026-02-20
- 상태: 확정
- 결정: 초대 링크 만료일은 관리자 설정값(`invite_expires_days`)으로 운영하고, 초대 생성 시 `expires_at`을 고정 저장
- 이유: 운영정책 변경을 즉시 반영하면서도, 기존 초대의 만료 기준을 안정적으로 유지하기 위함
- 영향: `/src/components/settings/UserRoleManager.tsx`, `/src/actions/invite-actions.ts`, `/src/app/api/invite/generate/route.ts`, `organization_invites` 스키마 (`84e3ff8`)

## 2026-02-20
- 상태: 확정
- 결정: 새 컬럼 미적용 환경을 위해 `expires_at`/`invite_expires_days` 조회·저장에 fallback 경로를 유지
- 이유: 마이그레이션 적용 전 환경에서 사용자 플로우가 즉시 깨지지 않도록 하기 위함
- 영향: 초대 생성/조회/만료 필터링 로직 전반 (`84e3ff8`)

## 2026-02-19
- 상태: 확정
- 결정: 설정/관리 화면을 모듈형 디자인으로 통일 (`surface-card`, `module-list`, `icon-button` 중심)
- 이유: 중첩 박스와 액션 스타일 혼재로 화면이 복잡하고 전문성이 떨어짐
- 영향: `/settings/*`, `/assets/manage`, `/spaces/manage`, `/vehicles/manage` 전반

## 2026-02-19
- 상태: 확정
- 결정: 메인 메뉴 기본 순서를 `도서 > 물품 > 공간 > 차량`으로 변경
- 이유: 사용자 우선순위와 신규 도서 모듈 노출 전략 반영
- 영향: 헤더 메뉴 렌더링, 메뉴 설정 기본값

## 2026-02-19
- 상태: 확정
- 결정: `피드백`을 메인 메뉴에서 제거하고 마이메뉴 내부로 이동
- 이유: 상단 네비게이션 밀도를 낮추고 핵심 기능 메뉴 집중도 확보
- 영향: 헤더 메뉴 구성 및 사용자 드롭다운 항목

## 2026-02-19
- 상태: 확정
- 결정: 마이메뉴 버튼에서 화살표 심볼 제거
- 이유: 시각적 노이즈 감소 및 헤더 미니멀 정렬
- 영향: `/src/components/layout/Header.tsx`

## 2026-02-19
- 상태: 확정
- 결정: 도서 도메인 내부 용어/테이블명은 `loan` 유지 (`lend` 미사용)
- 이유: 기존 구현과 스키마 일관성, 변경 비용 대비 이득 낮음
- 영향: API 경로, 테이블명, 코드 레퍼런스 전반

## 2026-02-19
- 상태: 확정
- 결정: 카카오 로그인 콜백에서 세션 확인 재시도 후 리다이렉트 처리
- 이유: 로그인 성공 직전 일시적 "인증 실패" 화면 깜빡임 완화
- 영향: `/src/app/auth/callback/page.tsx`

## 2026-02-19
- 상태: 확정
- 결정: 도서 기능은 "분리 가능한 모듈"로 설계하되 현재는 기존 앱 내 통합 운영
- 이유: 운영/권한/예약 모델 재사용성과 향후 독립 배포 가능성 동시 확보
- 영향: 메뉴 토글, 도서 라운지/운영 페이지 구조

## 2026-02-19
- 상태: 확정
- 결정: 시상은 선택 기능으로 두고, 기본은 점수/스트릭/응원 중심 경쟁 구조
- 이유: 기관별 운영 부담과 문화 차이를 고려한 유연성 확보
- 영향: 도서 게임화 정책 및 관리 설정

---

## 기록 규칙
- 신규 결정은 위 포맷 그대로 추가
- "변경"은 기존 항목을 덮어쓰지 말고 새 항목으로 남김
- 관련 커밋이 있으면 항목 끝에 커밋 해시를 추가
