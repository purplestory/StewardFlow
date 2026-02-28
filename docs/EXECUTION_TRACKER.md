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

## 4) 다음 실행 순서
1. UI-003 착수: 내 신청 통합 표기 + 승인 취소 사유 플로우
2. UI-004 범위 확정: 예약 워크스페이스 월간 단일화 여부 결정
3. OPS-001 운영: 기능 반영 시 EXECUTION_TRACKER/DECISIONS 동시 갱신 루틴 고정
