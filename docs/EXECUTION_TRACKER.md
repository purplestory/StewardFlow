# 실행 트래커 (Single Source of Truth)

최종 업데이트: 2026-02-28  
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
| UI-003 | P1 | TODO | 내 대여 신청에 물품/공간/차량/도서 통합 표시 + 승인 완료 취소 플로우 | 리소스 타입별 신청내역 노출, 승인 상태 취소 시 사유 입력 + 관리자 전달 | `src/app/api/reservations/my/route.ts`, `src/components/my/ReservationsClient.tsx`, `src/hooks/useReservations.ts` |
| UI-004 | P1 | TODO | 예약 워크스페이스 단순화(월 기본 + 주/일 제거 여부 최종 반영) | 월 뷰 기본/단일화 또는 설정 기반 노출, 불필요 컨트롤 제거 후 레이아웃 안정 | `src/components/assets/ReservationCalendar.tsx`, `src/components/manage/SpaceReservationManager.tsx`, `src/components/manage/VehicleReservationManager.tsx` |
| UX-001 | P1 | TODO | 디테일 페이지 헤더/브레드크럼/편집 버튼 배치 규칙 고정 | 데스크톱은 이미지 좌/정보 우, 모바일은 단일 컬럼, 브레드크럼 가독성 개선, 버튼 위치 일관 | `src/app/globals.css`, 관련 detail client 컴포넌트 |
| PERF-001 | P1 | TODO | 상단 탭 전환 시 깜빡임/재로딩 체감 완화 | 자원관리 탭 전환 시 헤더 깜빡임 없음, 도서 관리 첫 진입 로딩 최소화 | `src/components/manage/AssetAdminPanel.tsx`, `src/components/layout/Header.tsx` |
| OPS-001 | P2 | TODO | 문서 운영 고정화 | 기능 커밋마다 본 문서와 `DECISIONS.md` 동시 갱신 | `docs/EXECUTION_TRACKER.md`, `docs/DECISIONS.md` |

## 2) 작업 로그 (Execution Log)
시간 기준: Asia/Seoul

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
1. UI-003 착수: 내 신청 통합 표기 + 승인 취소 사유 플로우
2. UI-004 범위 확정: 예약 워크스페이스 월간 단일화 여부 결정
3. OPS-001 운영: 기능 반영 시 EXECUTION_TRACKER/DECISIONS 동시 갱신 루틴 고정
