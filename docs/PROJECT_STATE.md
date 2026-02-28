# PROJECT STATE

최종 업데이트: 2026-02-20  
기준 커밋: `c3cb5cf` (`fix: 도서 스키마 부트스트랩 마이그레이션 추가`)

## 1. 현재 제품 범위
- 코어: 인증, 사용자/권한, 물품/공간/차량 예약/승인/반납
- 확장: 도서 라운지(대여/반납/운영), 독서 기록/게임화(기초)
- 운영: 메뉴/정책/기관/부서/카테고리/감사 로그/휴지통/샘플데이터

## 2. 이번 사이클에서 확정된 내용
- 상단 메인 메뉴 기본 순서: `도서 > 물품 > 공간 > 차량`
- `피드백` 메뉴 위치: 상단 메인이 아니라 `마이메뉴` 내부
- 마이메뉴 버튼의 화살표 심볼 제거
- UI 방향: 중첩 박스 최소화, 모듈형 일관 UI로 통일
- 도서 내부 도메인/테이블 용어는 `loan` 유지 (`lend`로 변경하지 않음)
- 카카오 로그인 콜백에서 일시적 실패 화면 깜빡임 완화 로직 반영
- 관리자 설정에서 초대 링크 만료일(`1/3/7/14/30일`) 선택 가능
- 원격 Supabase에 도서 스키마 부트스트랩 마이그레이션 실적용 완료

## 3. 완료 상태(요약)
- 메뉴 순서 저장 후 새로고침 시 복원되던 버그 수정
- 설정/관리 페이지 공통 스타일 프리미티브 정리
- 편집/삭제 액션을 텍스트 링크에서 아이콘 버튼 중심으로 통일
- 도서 테이블 미적용 환경에서 사용자 친화형 오류 메시지 노출
- 초대 레코드 만료 시각(`organization_invites.expires_at`) 저장/검증 로직 반영

## 4. 현재 위험/주의사항
- 기본 운영 환경에서는 도서 테이블 미적용 이슈 해소됨
  - 확인: `book_items`, `book_loans` 포함 핵심 도서 테이블 API 응답 확인
  - 주의: 신규/별도 환경에서는 `20260220103000_bootstrap_books_schema.sql` 적용 필요
- 일부 환경에서 `invite_expires_days`, `expires_at` 컬럼 미적용 가능성 존재
  - 증상: 초대 만료일 저장/조회 시 `column ... does not exist`
  - 조치: `supabase/migrations/20260219_add_invite_expiration_policy.sql` 적용

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
