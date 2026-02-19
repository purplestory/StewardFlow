# UI SYSTEM

최종 업데이트: 2026-02-19

## 1. 목표
- 화면마다 다른 톤을 줄이고, 운영 화면을 모듈 단위로 일관되게 유지
- "박스 안에 박스 안에 박스" 구조를 줄여 인지 부담 최소화
- 버튼처럼 보이면 반드시 클릭 가능하게, 클릭 불가면 버튼처럼 보이지 않게

## 2. 핵심 원칙
- 큰 단위: `surface-panel`, `surface-card`
- 중간 단위: `module-head`, `module-toolbar`, `module-list`
- 액션 단위: `btn-primary`, `btn-outline`, `btn-danger`, `icon-button`
- 상태/필터 단위: `tab-shell`, `tab-chip`, `filter-pill`, `module-kpi`

## 3. 레이아웃 규칙
- 페이지 기본 스택: `manage-stack`
- 헤더/설명: `PageHero` 사용 우선
- 섹션 컨테이너: `SectionCard` 또는 `surface-card`
- 리스트: `module-list` + `list-row` 조합
- 모달: `modal-backdrop` + `modal-surface`

## 4. 상호작용 규칙
- 주요 CTA는 `btn-primary` 1개만 강조
- 취소/보조 액션은 `btn-outline` 사용
- 파괴 액션은 `btn-danger` 또는 `icon-button-danger`
- 토글은 `toggle-switch` 사용 (직접 커스텀 클래스 중복 금지)

## 5. 네비게이션 규칙
- 메인 메뉴 기본 순서: `도서 > 물품 > 공간 > 차량`
- 피드백은 메인 메뉴가 아니라 `마이메뉴` 내부 항목
- 마이메뉴 버튼의 드롭다운 화살표 심볼은 사용하지 않음

## 6. 용어 규칙
- 사용자 UI는 가능한 한 한글 중심
- 내부 도메인/테이블/레코드 명은 `loan` 유지
  - 예: `book_loans`, `loan_status`
  - `lend`로 치환하지 않음

## 7. 금지 패턴
- 클릭 불가 요소를 버튼 스타일로 표현
- 동일 정보 영역에서 불필요한 중첩 카드 사용
- 화면별로 다른 수정/삭제 액션 모양(텍스트/아이콘 혼용)
- 동일 의미의 토글/칩/버튼을 페이지마다 다른 규격으로 구현

## 8. 변경 체크리스트
UI 변경 PR/커밋 전에 아래 확인:
1. `h-10` 계열 입력/버튼 높이 일관성
2. 주요/보조/삭제 액션 위계 명확성
3. 리스트 행 밀도와 패딩 통일
4. 모바일(좁은 폭)에서 줄바꿈/오버플로우 점검
5. `Notice` 기반 에러/빈상태 메시지 가독성 점검
