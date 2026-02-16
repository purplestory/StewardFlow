# 웹푸시 + 텔레그램 알림 설정 가이드

## 1) VAPID 키 생성

```bash
npm run generate:vapid
```

출력된 값을 `.env.local` 또는 Vercel 환경 변수에 등록하세요.

필수 값:

- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY_PEM`
- `WEB_PUSH_VAPID_SUBJECT` (예: `mailto:admin@example.com`)

## 2) 텔레그램 봇 환경 변수

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID`

> `TELEGRAM_DEFAULT_CHAT_ID`는 교역자/운영진이 보는 그룹 채팅 ID를 권장합니다.

## 3) DB 마이그레이션 적용

`supabase/migrations/20260217_create_push_subscriptions.sql`를 실행해 `push_subscriptions` 테이블과 RLS 정책을 추가하세요.

## 4) 동작 확인

1. 모바일/브라우저에서 로그인
2. 알림 권한 허용
3. 예약 승인/반납/양도요청 이벤트 발생
4. 웹푸시 도착 및 텔레그램 채널 수신 확인

## 참고

- 현재 구현은 **payload-less 웹푸시** 방식입니다.
- 푸시 자체는 백그라운드/앱 종료 상태에서도 도착하며, 알림 클릭 시 `/notifications` 또는 관련 화면으로 이동합니다.

