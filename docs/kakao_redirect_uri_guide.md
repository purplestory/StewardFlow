# 카카오 개발자 센터 Redirect URI 등록 가이드

## 📍 Redirect URI 등록 위치

### 단계별 안내

#### 1단계: 카카오 개발자 센터 접속
1. https://developers.kakao.com 접속
2. 로그인

#### 2단계: 내 애플리케이션으로 이동
1. 상단 메뉴에서 **"내 애플리케이션"** 클릭
2. 또는 왼쪽 사이드바의 **"내 애플리케이션"** 클릭

#### 3단계: 앱 선택
1. 앱 목록에서 **"스튜어드 플로우"** 클릭

#### 4단계: 카카오 로그인 메뉴로 이동
1. 왼쪽 메뉴에서 **"제품 설정"** 클릭
2. 하위 메뉴에서 **"카카오 로그인"** 클릭

#### 5단계: Redirect URI 등록 섹션 찾기
"카카오 로그인" 페이지에서 다음 섹션을 찾습니다:

```
┌─────────────────────────────────────────┐
│ 카카오 로그인 설정                      │
├─────────────────────────────────────────┤
│ 활성화 설정: [ON]                       │
│                                         │
│ Redirect URI 등록                       │ ← 여기!
│ ┌───────────────────────────────────┐ │
│ │ https://example.com/callback      │ │
│ │ [삭제]                             │ │
│ └───────────────────────────────────┘ │
│                                         │
│ [+ Redirect URI 추가]                   │ ← 이 버튼 클릭
│                                         │
└─────────────────────────────────────────┘
```

#### 6단계: Redirect URI 추가
1. **"+ Redirect URI 추가"** 버튼 클릭
   - 또는 기존 URI 입력 필드가 있으면 직접 입력
2. 입력 필드에 Supabase Redirect URL 입력:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
   - 예시: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
3. **"등록"** 또는 **"저장"** 버튼 클릭

#### 7단계: 확인
- 등록한 Redirect URI가 목록에 표시되는지 확인
- 여러 개 등록 가능 (개발용, 프로덕션용, Supabase용 등)

## 📝 등록해야 할 Redirect URI 목록

### 필수
1. **Supabase 콜백 URL** (필수)
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
   - Supabase 대시보드에서 복사한 정확한 URL

### 선택 (개발/프로덕션용)
2. **로컬 개발용** (선택)
   ```
   http://localhost:3000/auth/callback
   ```

3. **프로덕션용** (선택, 배포 후)
   ```
   https://yourdomain.com/auth/callback
   ```

## ⚠️ 주의사항

### URL 형식
- **정확히 일치**해야 합니다 (대소문자, 슬래시, 프로토콜 등)
- 공백이 포함되지 않도록 주의
- 마지막 슬래시(`/`)도 일치해야 합니다

### Supabase Redirect URL 찾는 방법
1. Supabase 대시보드 → Authentication → Providers
2. Kakao 설정 화면에서 "Redirect URL" 확인
3. 또는 Authentication → URL Configuration → Redirect URLs에서 확인

### 등록 후 확인
- 등록한 URI가 목록에 정확히 표시되는지 확인
- 오타가 없는지 다시 한 번 확인

## 🔍 문제 해결

### "Invalid redirect_uri" 오류가 발생하는 경우
1. 카카오에 등록한 URI와 Supabase의 URI가 **정확히 일치**하는지 확인
2. 프로토콜(`https://`)이 일치하는지 확인
3. 도메인 부분이 정확한지 확인
4. 경로(`/auth/v1/callback`)가 정확한지 확인

### Redirect URI가 보이지 않는 경우
- "제품 설정" → "카카오 로그인" 메뉴로 이동했는지 확인
- "활성화 설정"이 ON인지 확인
- 페이지를 새로고침

## ✅ 체크리스트

- [ ] 카카오 개발자 센터 → "내 애플리케이션" → "스튜어드 플로우" 선택
- [ ] "제품 설정" → "카카오 로그인" 메뉴로 이동
- [ ] "Redirect URI 등록" 섹션 찾기
- [ ] Supabase Redirect URL 복사
- [ ] "+ Redirect URI 추가" 버튼 클릭
- [ ] Supabase Redirect URL 입력
- [ ] "등록" 또는 "저장" 클릭
- [ ] 등록된 URI 확인
