## RLS 검증 체크리스트

> `supabase/rls.sql`은 legacy reference다. production, recovery, 새 baseline에는 실행하지 않는다.
> 현재 기준은 `docs/recovery_baseline.md`와 `20260824090000_harden_tenant_rls_boundaries.sql`의 postcheck다.

### 1) 준비 단계
- `organizations` 테이블에 조직 데이터가 있는지 확인
- `profiles.organization_id`가 사용자마다 입력되어 있는지 확인
- `assets/spaces/reservations/space_reservations/approval_policies/notifications`에
  `organization_id`가 비어 있지 않은지 확인

### 2) 검증 순서
1. hardening migration 및 read-only postcheck 결과 확인
2. 관리자 계정으로 로그인 후 기본 화면 접근 확인
3. 일반 사용자 계정으로 로그인 후 접근 제한 확인

### 3) 권한 점검 시나리오
- 다른 조직 데이터가 보이지 않는지 확인
- 예약 생성 시 `organization_id` 자동 입력 확인
- 예약 승인/반납 시 접근 권한이 올바르게 제한되는지 확인

### 4) 장애 발생 시 대응
- production RLS를 비활성화하거나 legacy policy SQL을 재실행하지 않음
- 오류는 격리된 restore DB에서 재현하고 current baseline의 policy/trigger/function 차이를 확인
- production 변경이 필요하면 backup, action-time approval, 검증 SQL을 갖춘 별도 migration만 적용
