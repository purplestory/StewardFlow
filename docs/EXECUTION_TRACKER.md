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

## 4) 다음 실행 순서
1. UI-003 착수: 내 신청 통합 표기 + 승인 취소 사유 플로우
2. UI-004 범위 확정: 예약 워크스페이스 월간 단일화 여부 결정
3. OPS-001 운영: 기능 반영 시 EXECUTION_TRACKER/DECISIONS 동시 갱신 루틴 고정
