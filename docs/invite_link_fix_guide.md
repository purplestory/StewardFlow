# 초대 링크 작동 문제 해결 가이드

## 문제 상황

초대 링크(`https://steward-flow.vercel.app/join?token=Wfq-SXAm1e`)가 로딩 상태에서 멈추는 문제가 발생했습니다.

## 원인

`organization_invites` 테이블의 RLS(Row Level Security) 정책이 `authenticated` 사용자만 허용하여, 로그인하지 않은 사용자가 초대 링크를 확인할 수 없었습니다.

## 해결 방법

### 1단계: Supabase에서 마이그레이션 실행

1. **Supabase 대시보드 접속**
   - [Supabase Dashboard](https://app.supabase.com) 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 사이드바에서 **"SQL Editor"** 클릭

3. **마이그레이션 SQL 실행**
   - 다음 SQL 코드를 복사하여 SQL Editor에 붙여넣기:

```sql
-- Allow anonymous users to read organization_invites by token
-- This is necessary for invite links to work for non-authenticated users

-- Add policy for anonymous users to read invites by token
CREATE POLICY "organization_invites_select_by_token_anon"
ON public.organization_invites
FOR SELECT
TO anon
USING (
  accepted_at IS NULL
  AND revoked_at IS NULL
  AND created_at > (NOW() - INTERVAL '7 days')
);

-- Also allow authenticated users to read by token
CREATE POLICY "organization_invites_select_by_token_authenticated"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (
  (accepted_at IS NULL
   AND revoked_at IS NULL
   AND created_at > (NOW() - INTERVAL '7 days'))
  OR email = (auth.jwt() ->> 'email')
  OR organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);
```

4. **"Run" 버튼 클릭** (또는 `Cmd+Enter` / `Ctrl+Enter`)

5. **결과 확인**
   - "Success. No rows returned" 메시지가 표시되면 성공입니다.

### 2단계: 코드 변경 확인

다음 변경사항이 적용되었습니다:

1. **서버 액션 개선** (`src/actions/invite-actions.ts`)
   - 기관 이름을 서버 액션에서 함께 반환하도록 수정
   - RLS 정책 오류에 대한 더 명확한 에러 메시지 추가

2. **클라이언트 코드 개선** (`src/app/join/page.tsx`)
   - 서버 액션에서 받은 기관 이름 사용
   - 불필요한 `organizations` 테이블 조회 제거

### 3단계: 테스트

1. **초대 링크 테스트**
   - 시크릿 모드(또는 로그아웃 상태)에서 초대 링크 접속
   - 예: `https://steward-flow.vercel.app/join?token=Wfq-SXAm1e`

2. **예상 동작**
   - 초대 정보가 정상적으로 로드됨
   - 기관 이름, 역할, 부서 정보가 표시됨
   - 가입 폼이 정상적으로 표시됨

3. **문제가 지속되는 경우**
   - 브라우저 개발자 도구(F12) → Console 탭에서 에러 확인
   - Network 탭에서 실패한 요청 확인
   - Supabase 대시보드 → Logs에서 에러 로그 확인

## 보안 고려사항

이 마이그레이션은 다음 보안 조치를 포함합니다:

- ✅ 유효한 초대만 조회 가능 (수락되지 않음, 취소되지 않음, 만료되지 않음)
- ✅ 토큰을 모르면 특정 초대를 찾을 수 없음
- ✅ 서버 액션에서 토큰으로 필터링하므로 안전함
- ✅ 만료된 초대는 자동으로 차단됨 (7일)

## 추가 참고사항

- 마이그레이션 파일 위치: `supabase/migrations/20260209_allow_anon_read_invites_by_token.sql`
- 초대 링크 유효기간: 7일 (최소)
- 관련 문서: `docs/how_to_run_sql.md`
