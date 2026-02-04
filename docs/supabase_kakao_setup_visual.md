# Supabase 카카오 OAuth 설정 가이드 (단계별)

## 📍 Supabase 대시보드에서 카카오 키 입력 위치

### 1단계: Supabase 대시보드 접속
1. https://supabase.com/dashboard 접속
2. 로그인 후 프로젝트 선택

### 2단계: Authentication 메뉴로 이동
1. 왼쪽 사이드바에서 **"Authentication"** 클릭
   - 아이콘: 🔐 (자물쇠 모양)

### 3단계: Providers 탭 선택
1. 상단 탭 메뉴에서 **"Providers"** 클릭
   - 다른 탭: Users, Policies, URL Configuration 등

### 4단계: Kakao Provider 찾기
1. Provider 목록에서 **"Kakao"** 찾기
   - 알파벳 순서로 정렬되어 있으므로 "K" 섹션에서 찾기
   - 또는 검색창에 "kakao" 입력

### 5단계: Kakao 활성화
1. **"Enable Kakao"** 토글 버튼을 **ON**으로 변경
   - 토글이 ON이 되면 설정 폼이 나타납니다

### 6단계: 카카오 키 입력
설정 폼에 다음 정보를 입력합니다:

```
┌─────────────────────────────────────────┐
│ Kakao Provider Settings                 │
├─────────────────────────────────────────┤
│                                         │
│ Enable Kakao: [ON]                     │
│                                         │
│ Kakao Client ID:                       │
│ [___________________________]          │
│ ↑ 여기에 REST API 키 입력               │
│                                         │
│ Kakao Client Secret:                    │
│ [___________________________]           │
│ ↑ 여기에 Client Secret 입력             │
│                                         │
│ Redirect URL:                            │
│ https://xxx.supabase.co/auth/v1/...    │
│ ↑ 자동 생성됨 (카카오에 등록 필요)      │
│                                         │
│ [Save] [Cancel]                         │
└─────────────────────────────────────────┘
```

### 입력할 정보

#### Kakao Client ID
- **위치**: 카카오 개발자 센터 → "앱 설정" → "앱 키"
- **항목**: REST API 키
- **형식**: 긴 문자열 (예: `1234567890abcdefghijklmnopqrstuv`)

#### Kakao Client Secret
- **위치**: 카카오 개발자 센터 → "제품 설정" → "카카오 로그인" → "보안"
- **항목**: Client Secret 코드
- **생성**: "Client Secret 코드 생성" 버튼 클릭 후 복사
- **형식**: 긴 문자열 (예: `AbCdEfGhIjKlMnOpQrStUvWxYz123456`)

### 7단계: 저장
1. 모든 정보 입력 후 **"Save"** 또는 **"Update settings"** 버튼 클릭
2. 저장 완료 메시지 확인

### 8단계: Redirect URL 복사
1. 설정 화면에 표시된 **Redirect URL** 복사
2. 카카오 개발자 센터로 돌아가서 이 URL을 Redirect URI에 등록

## ⚠️ 주의사항

- REST API 키와 Client Secret은 정확히 입력해야 합니다
- 공백이나 줄바꿈이 포함되지 않도록 주의하세요
- 저장 후에는 입력한 값이 마스킹되어 표시됩니다 (보안상 정상입니다)

## 🔍 문제 해결

### "Invalid client" 오류
- REST API 키가 정확한지 확인
- 카카오 개발자 센터에서 키를 다시 복사해서 입력

### "Client authentication failed" 오류
- Client Secret이 정확한지 확인
- Client Secret을 새로 생성해서 입력

### 설정 화면이 보이지 않음
- "Enable Kakao" 토글이 ON인지 확인
- 브라우저 새로고침
