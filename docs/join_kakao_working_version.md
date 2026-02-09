# 초대코드 + 카카오 가입이 동작하던 버전 (참고)

## 성공했던 커밋

- **커밋**: `ee23b43` — "Enhance join page with KakaoTalk support and fix user deletion"
- **날짜**: 2026-02-07

## 그때와의 차이 (요약)

| 구분 | ee23b43 (동작하던 버전) | 현재 (여러 수정 후) |
|------|-------------------------|----------------------|
| **redirectTo** | `${origin}/auth/callback?next=${encodeURIComponent(nextUrl)}` (전체 URL) | `${origin}/auth/callback` (쿼리 없음) |
| **토큰 유지** | `next` 쿼리 파라미터만 의존 | localStorage, 쿠키, httpOnly 쿠키 등으로 보완 |
| **초대 수락** | join 페이지에서 직접 RLS로 프로필 업데이트 시도 | Server Action `acceptInviteByToken` (Admin 클라이언트) |

## 왜 그때는 됐을 수 있는지

1. **Supabase/Kakao가 redirect_uri의 쿼리를 유지했을 때**  
   `redirectTo`에 `?next=/join?token=xxx`를 넣어도, 리다이렉트 후 그대로 `/auth/callback?next=...`로 들어왔을 가능성.
2. **Supabase Redirect URL 설정**  
   대시보드에 `https://steward-flow.vercel.app/auth/callback`만 등록돼 있으면, `?next=...`가 붙은 URL은 허용/차단이 프로바이더마다 달라질 수 있음. 그때는 허용되던 환경이었을 수 있음.

## 해당 버전 코드 확인/복원 방법

```bash
# join 페이지 그때 버전 보기
git show ee23b43:src/app/join/page.tsx

# auth callback 그때 버전 보기
git show ee23b43:src/app/auth/callback/page.tsx

# 해당 커밋으로 join·callback만 되돌리기 (참고용, 충돌 시 수동 병합)
git show ee23b43:src/app/join/page.tsx > /tmp/join-ee23b43.tsx
git show ee23b43:src/app/auth/callback/page.tsx > /tmp/callback-ee23b43.tsx
```

## 권장 확인 사항 (지금도 적용)

1. **Supabase → Authentication → URL Configuration → Redirect URLs**  
   - `https://steward-flow.vercel.app/auth/callback` 포함 여부  
   - 필요하면 와일드카드 지원 시 `https://steward-flow.vercel.app/auth/callback*` 같은 패턴 확인
2. **Vercel 환경 변수**  
   - `SUPABASE_SERVICE_ROLE_KEY` 설정 (초대 수락 Server Action용)
3. **리다이렉트 후 실제 URL**  
   - 카카오 로그인 후 브라우저 주소창에 `/auth/callback`인지 `/join`인지, `?next=` 또는 `?token=` 존재 여부 확인

이 문서는 “성공했던 코드”를 git에서 찾은 결과와, 그 버전과 현재의 차이를 정리한 참고용입니다.
