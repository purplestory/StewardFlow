# NEXT TASKS

최종 업데이트: 2026-08-25

> 운영 기준 문서가 `docs/EXECUTION_TRACKER.md`로 통합되었습니다.  
> 본 문서는 중장기 TODO 요약만 유지하며, 실제 진행/결과/RCA는 실행 트래커에 기록합니다.

## P0 (즉시)

> Vercel production 배포와 `20260824090000_harden_tenant_rls_boundaries.sql` 원격 적용은 완료되었다.
> ACL-inclusive DB 복원, 정규화 카탈로그 비교, archive-backed canonical baseline 정리는 완료됐다. 현재 P0 잔여는 signed-in 운영 회귀 QA다. 운영 소스는 `29da08a`로 `origin/main`에 반영됐다.

### 1) 원격 DB 백업 및 복원 절차 확인
- 상태: hardening 전/후 archive 검증과 NAS ACL-inclusive 복원 리허설 완료; authoritative procedure는 `docs/recovery_baseline.md`
- 완료 조건(AC):
1. 사용자에게 백업/원격 작업 범위와 실행 시점을 직전 확인
2. hardening 적용 전 수동 논리 백업 또는 동등한 복구 산출물 생성
3. 백업 위치/보존기간/담당자 기록
4. 최소 restore 절차 또는 복원 리허설 결과 기록

### 2) 로컬 변경 프로덕션 배포
- 상태: Vercel production 배포 완료 (`dpl_Ftp6DqqicKEhPBp8DtZuraiCaWMS`, `READY`); source commit/push 완료, signed-in smoke 필요
- 완료 조건(AC):
1. 배포 명령 실행 직전 사용자에게 대상 환경/범위를 확인
2. 현재 uncommitted 변경 검토/커밋
3. CI `lint`, `lint:mobile`, `typecheck`, `test`, `build` 통과
4. Vercel production 배포 후 배포 SHA/시간 기록
5. 인증, invite-only 가입, 내 신청, 기관/사용자 관리 기본 smoke test 통과
6. 플랫폼 전역 관리가 필요할 때만 승인된 auth user ID를 `PLATFORM_ADMIN_USER_IDS`에 설정하고, 기본값은 미설정으로 유지

### 3) 테넌트 RLS hardening 원격 적용
- 상태: 원격 적용 및 19개 read-only postcheck 완료; signed-in 테넌트/기능 QA 필요
- 대상: `supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql`
- 완료 조건(AC):
1. 1번 수동 백업/복원 절차 확인과 사용자 최종 확인 후 migration 적용
2. profile privileged field trigger와 tenant helper 함수 존재 확인
3. 전역 admin/pending profile 정책 및 anon invite table access 제거 확인
4. 조직 admin이 타 조직 사용자/기관을 조회·수정할 수 없음을 signed-in 세션으로 검증
5. `cancel_requested_book_loan_atomic(uuid, uuid)` 존재/실행 권한/요청 취소 상태 정합성 확인
6. profile 부서 실존 및 마지막 admin UPDATE/DELETE trigger 존재·동시성 차단 확인
7. account deletion UUID snapshot/FK SET NULL/operation index와 service-only RPC 4종의 존재·실행 권한 확인

### 4) Migration history baseline reconciliation
- 상태: 완료 (archive-backed canonical baseline 확정; production migration history는 변경하지 않음)
- 배경: hardening은 수동 적용되어 history를 수정하지 않았고 원격 migration history에는 `20260220103000`만 기록됨
- 완료 조건(AC):
1. 완료: fresh source schema dump와 restored catalog의 table/function/policy/RLS/trigger 233개 차이 `0` 확인
2. 완료: Realtime runtime role이 있는 격리 환경에서 ACL-inclusive restore와 security postcheck 통과
3. 완료: archive-backed baseline과 forward-only migration 전략을 `docs/migration_lineage.md`에 확정
4. 완료: 신규 빈 DB의 staged recovery procedure 문서화
5. 완료: 운영 DB에 로컬 migration 전체를 일괄 replay하지 않는 보호 절차 명시
6. 선택: Auth/Storage 등 전체 self-hosted application service의 기능 검증은 NAS 방화벽/네트워크 설계에 대한 별도 승인 후 진행

### 5) 카카오 OAuth signed-in 회귀 테스트
- 상태: 진행 중 (콜백 보강 및 open redirect 차단 완료, 실환경 QA 필요)
- 전제: 기존 운영 계정은 `admin` 3명, `manager` 3명, 일반 `user` 0명이다. 변경 검증은 이메일이 일치하는 전용 테스트 `user` 초대 후에만 수행한다.
- 완료 조건(AC):
1. 카카오 로그인 시 실패 페이지 깜빡임이 재현되지 않음
2. 로그인 후 쿠키/재접속/새 탭에서 세션 유지 확인
3. 실패 시 `/login?error=...` 처리 일관성 확인
4. 외부/변형 `next` 입력이 항상 내부 안전 경로로 귀결됨
5. production, branch preview, 모바일 앱 전환 시나리오 확인

### 6) Git 추적 npm 캐시 정리
- 상태: 완료
- 결과: `.npm/`, `.npm-cache/` 1,861개 cache/log 파일을 Git index에서만 제거했다. working tree의 약 475MB cache는 유지되며 `.gitignore`가 재추적을 막는다.
- 완료 조건(AC):
1. 완료: 캐시 파일 추적 제거 전 영향 검토
2. 완료: 별도 커밋으로 index에서 제거
3. 완료: ignore 규칙과 lint/typecheck/test로 재추적·작동 영향 없음 확인
4. 완료: repository/history rewrite는 force push를 요구하므로 이번 작업 범위에서 수행하지 않음

### 7) 메뉴/정책 화면 시각 QA
- 상태: 진행 중
- 현재 결과: 355px mobile 및 1309px desktop 접근 화면은 horizontal overflow 없이 렌더됐고, 긴 메뉴/카테고리/기관명/이메일이 액션을 밀지 않도록 반응형 규칙을 보강했다. actual signed-in data 화면은 카카오 로그인 세션 대기 상태다.
- 완료 조건(AC):
1. 진행 중: `/settings/menu`, `/settings/org`, `/settings/users`에서 컴포넌트 간 간격/버튼 규격 일관
2. 완료(접근 화면/정적 검사): 모바일 폭에서 액션 버튼 줄바꿈/오버플로우 없음
3. 진행 중: 수정 액션이 아이콘 스타일로 일관되며, 기관 삭제 비활성화 안내가 명확함

### 8) 초대 만료 정책 기능 QA
- 상태: DB 컬럼 확인 완료, invite-only 서버 하드닝 실환경 QA 필요
- 완료 조건(AC):
1. 원격 `organizations.invite_expires_days` 컬럼 존재 확인 완료
2. 원격 `organization_invites.expires_at` 컬럼 존재 확인 완료
3. 사용자 관리 화면에서 만료일 저장 후 신규 초대 만료 시각 반영 확인
4. 만료/취소/수락된 초대의 서버 token 검증 동작 확인
5. `/join-request`가 `/join`으로 이동하고 초대 없는 공개 가입 신청이 불가능함을 확인
6. 가입자가 role/department를 변조해도 서버가 초대 레코드 값만 적용하고, 이메일 불일치/재사용/기존 기관 소속 계정을 거부하는지 확인
7. 타 기관 ID 변조, manager의 admin·무부서·타부서 초대는 거부하고 자기 담당 부서의 manager/user 초대만 허용하는지 확인

### 9) 도서 마이그레이션 및 원자 취소 적용 확인
- 상태: 도서 bootstrap과 hardening RPC 원격 적용 완료, signed-in 기능 QA 필요
- 완료 조건(AC):
1. 운영 환경에서 `book_items`, `book_loans` 존재 확인
2. 도서 홈(`/books`)에서 테이블 누락 오류 미노출
3. 도서 운영(`/books/manage`)에서 목록/승인/반납 조회 정상
4. hardening 적용 후 요청 상태 취소가 원자 RPC로 대출/도서 상태를 함께 정리
5. 같은 승인 후 취소 요청의 unread 알림이 있으면 중복 insert 없이 `alreadyRequested` 응답

### 10) 부서 변경 승인 서버 경계 회귀 테스트
- 상태: production 배포와 migration 적용 완료, signed-in QA 필요
- 완료 조건(AC):
1. 조직 admin은 자기 조직의 유효한 pending 요청만 승인 가능
2. manager는 담당 부서의 일반 사용자 요청만 승인하고 자기 요청은 승인할 수 없음
3. 대상 부서/사용자 상태가 바뀐 stale 요청은 조건부 갱신에서 거부
4. 요청 상태 갱신 실패 시 프로필 부서 보상 복구와 서버 오류 로그 확인

### 11) 계정 삭제 승인/역할 인계 회귀 테스트
- 상태: production 배포와 migration 적용 완료, signed-in QA 필요
- 완료 조건(AC):
1. 동일 기관 admin만 manager 탈퇴 요청을 승인·거절할 수 있음
2. 동일 기관·동일 부서의 현재 user만 역할 인계 대상으로 허용
3. operation ID claim 재시도는 멱등이며 역할 revision 충돌 시 자동 덮어쓰기 없이 `manual_review`로 전환
4. Auth 삭제 확정 실패는 rollback, 불명확 결과는 processing 유지, 성공은 finalize
5. 삭제 뒤 요청 행과 UUID snapshot이 남고, 직접·동시 마지막 admin 삭제/강등/이관이 DB에서 차단

## P1 (단기)

### 12) 일반 사용자 직접 삭제 authorization marker
- 상태: 설계 필요 (현재 same-org admin 재검증은 있으나 Auth 외부 호출 전후의 미세 TOCTOU 잔존)
- 완료 조건(AC):
1. DB RPC가 actor/target tenant·role을 잠그고 단일 사용 deletion authorization marker 발급
2. profile DELETE trigger가 유효한 marker를 검증·소비
3. actor 강등, target tenant 이동, 재사용·만료 marker가 삭제를 차단

### 13) 도서 자율 대출/반납 UX 고도화
- 상태: 일부 구현됨
- 완료 조건(AC):
1. 대출: 스캔 기반 시작 플로우가 모바일에서 3탭 이내
2. 반납: 책 코드 + 위치(서가) + 사진 증빙 플로우가 중단 없이 완료
3. 관리자 검증 상태(`pending/verified/rejected`) 필터 동작

### 14) 게임화 리더보드/응원 문구 튜닝
- 상태: 기본 구현
- 완료 조건(AC):
1. 월간 점수/스트릭/응원 데이터 0건일 때도 UI 안정
2. 과도 경쟁 방지를 위한 안내 문구 및 정책 노출
3. 시상 기능은 `옵션`으로만 노출

## P2 (중기)

### 15) 문서 정리 체계 자동화
- 상태: 신규
- 완료 조건(AC):
1. 기능 커밋 시 `PROJECT_STATE` 또는 `DECISIONS` 업데이트 규칙 정착
2. 릴리스 전 `DB_MIGRATION_STATUS` 최신화
3. 오래된 중복 문서(`project_status.md` 등) 정리 계획 수립

### 16) 교회 운영 정보공유 기능(주변 주문/구매/행사 준비)
- 상태: 신규
- 완료 조건(AC):
1. 교회 주변 배달 가능 업체/온라인 주문처/행사 준비 물품 구매처를 등록할 수 있음
2. 항목별로 `카테고리(식사/간식/소모품/인쇄/기타)`, `부서/행사 태그`, `주문 링크/연락처`, `운영 메모`를 저장 가능
3. 사용자 화면에서 검색/필터(카테고리, 태그, 최근 등록)로 빠르게 찾을 수 있음
4. 관리자/부서 관리자가 추천(고정) 항목 지정 및 오래된 정보 비활성화 가능
5. 잘못된 정보 신고 또는 수정 제안 흐름(간단 피드백) 제공

---

## 작업 시작 체크
새 작업 시작 시 아래 3개 먼저 확인:
1. `docs/PROJECT_STATE.md`
2. `docs/DECISIONS.md`
3. `docs/DB_MIGRATION_STATUS.md`
