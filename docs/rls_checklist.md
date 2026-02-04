## RLS 적용 체크리스트

### 1) 준비 단계
- `organizations` 테이블에 조직 데이터가 있는지 확인
- `profiles.organization_id`가 사용자마다 입력되어 있는지 확인
- `assets/spaces/reservations/space_reservations/approval_policies/notifications`에
  `organization_id`가 비어 있지 않은지 확인

### 2) 적용 순서
1. `supabase/rls.sql` 실행
2. 관리자 계정으로 로그인 후 기본 화면 접근 확인
3. 일반 사용자 계정으로 로그인 후 접근 제한 확인

### 3) 권한 점검 시나리오
- 다른 조직 데이터가 보이지 않는지 확인
- 예약 생성 시 `organization_id` 자동 입력 확인
- 예약 승인/반납 시 접근 권한이 올바르게 제한되는지 확인

### 4) 장애 발생 시 대응
- RLS 비활성화: `alter table ... disable row level security;`
- 문제 재현 후 정책 단위로 활성화 재적용
