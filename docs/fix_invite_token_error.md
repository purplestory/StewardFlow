# 초대 토큰 오류 해결 방법

## 문제
`column organization_invites.token does not exist` 오류가 발생하는 경우

## 해결 방법

Supabase SQL Editor에서 다음 마이그레이션을 실행하세요:

```sql
-- Add token field to organization_invites for invite links
alter table public.organization_invites
  add column if not exists token text unique;

-- Create index for faster token lookups
create index if not exists idx_organization_invites_token
  on public.organization_invites(token)
  where token is not null and accepted_at is null and revoked_at is null;
```

## 실행 방법

1. Supabase Dashboard에 로그인
2. SQL Editor로 이동
3. 위 SQL을 복사하여 실행
4. 브라우저 새로고침

## 참고

이 마이그레이션은 `supabase/migrations/20260203_add_invite_token.sql` 파일에 있습니다.
