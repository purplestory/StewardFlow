# 카카오톡 로그인 연동 가이드

Supabase를 통해 카카오톡 OAuth 로그인을 설정하는 방법입니다.

## 1. 카카오 개발자 센터 설정

### 1.1 앱 등록

1. [카카오 개발자 센터](https://developers.kakao.com)에 접속
2. **왼쪽 상단 메뉴에서 "내 애플리케이션" 클릭**
3. **"애플리케이션 추가하기" 버튼 클릭**
4. 앱 이름, 사업자명 입력 후 저장

> 💡 **참고**: "Develop with Tool" 페이지가 아닌, 상단 메뉴의 **"내 애플리케이션"**으로 이동해야 합니다.

### 1.2 플랫폼 설정

1. **내 애플리케이션 목록에서 등록한 앱 클릭**
2. 왼쪽 메뉴에서 **"앱 설정" → "플랫폼"** 클릭
3. **"Web 플랫폼 추가"** 버튼 클릭
4. 사이트 도메인 입력:
   - 개발용: `http://localhost:3000`
   - 프로덕션용: `https://yourdomain.com`
5. 저장

### 1.3 카카오 로그인 활성화

1. 앱 선택 후 왼쪽 메뉴에서 **"제품 설정" → "카카오 로그인"** 클릭
2. **"활성화 설정"을 ON으로 변경**
3. **"Redirect URI 등록"** 섹션에서 URI 추가:
   - 개발: `http://localhost:3000/auth/callback`
   - 프로덕션: `https://yourdomain.com/auth/callback`
   - **Supabase 콜백 (필수)**: `https://[your-project-ref].supabase.co/auth/v1/callback`
4. **OpenID Connect 설정 (선택, 권장)**:
   - OpenID Connect를 활성화하면 더 많은 사용자 정보(이메일, 프로필 등)를 안정적으로 받을 수 있습니다
   - "OpenID Connect" 섹션에서 활성화 (선택 사항이지만 권장)
5. 저장

### 1.4 동의 항목 설정 (⚠️ 필수)

**오류 방지를 위해 반드시 설정해야 합니다!**

1. **"제품 설정" → "카카오 로그인" → "동의항목"** 클릭
2. **필수 동의 항목** 설정:
   - ✅ **카카오계정(이메일)** (`account_email`)
     - 필수 여부: 선택
     - 목적: 이메일 로그인에 필요
     - **반드시 활성화 필요**
   
3. **선택 동의 항목** 설정:
   - ✅ **닉네임** (`profile_nickname`)
     - 필수 여부: 선택
     - 목적: 사용자 이름 표시
     - **활성화 권장**
   
   - ✅ **프로필 사진** (`profile_image`)
     - 필수 여부: 선택
     - 목적: 프로필 이미지 표시
     - **활성화 권장**

4. 각 동의 항목의 **"활성화"** 토글을 **ON**으로 변경
5. **저장** 버튼 클릭

> ⚠️ **중요**: Supabase가 요청하는 동의 항목(`account_email`, `profile_nickname`, `profile_image`)을 모두 활성화해야 오류가 발생하지 않습니다.

### 1.5 REST API 키 확인

1. **"앱 설정" → "앱 키"** 클릭
2. **REST API 키** 복사 (나중에 Supabase에 입력)
3. **Client Secret 생성** (필요시):
   - "제품 설정" → "카카오 로그인" → "보안"
   - "Client Secret 코드 생성" 클릭
   - 생성된 코드 복사 (Supabase에 입력)

## 2. Supabase 설정

### 2.1 Authentication 설정

1. **Supabase 대시보드** 접속: https://supabase.com/dashboard
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **"Authentication"** 클릭
4. 상단 탭에서 **"Providers"** 클릭
5. 목록에서 **"Kakao"** 찾기 (검색창에 "kakao" 입력하면 빠르게 찾을 수 있습니다)
6. **"Enable Kakao"** 토글 버튼을 **ON**으로 변경

### 2.2 카카오 OAuth 정보 입력

Kakao Provider 설정 화면에서 다음 정보를 입력합니다:

1. **Kakao Client ID (REST API 키)**:
   - 카카오 개발자 센터 → "앱 설정" → "앱 키"에서 복사한 **REST API 키** 입력
   - 예: `1234567890abcdefghijklmnopqrstuv`

2. **Kakao Client Secret**:
   - 카카오 개발자 센터 → "제품 설정" → "카카오 로그인" → "보안"에서 생성한 **Client Secret** 입력
   - 예: `AbCdEfGhIjKlMnOpQrStUvWxYz123456`

3. **Redirect URL 확인** (자동 생성됨):
   - Supabase가 자동으로 생성한 URL을 확인
   - 형식: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - 이 URL을 복사해서 카카오 개발자 센터의 Redirect URI에 등록해야 합니다

4. **"Save"** 또는 **"Update settings"** 버튼 클릭하여 저장

### 2.3 Redirect URL을 카카오에 등록

1. **카카오 개발자 센터**로 돌아가기
2. **"내 애플리케이션"** → **"스튜어드 플로우"** 앱 선택
3. 왼쪽 메뉴에서 **"제품 설정" → "카카오 로그인"** 클릭
4. **"Redirect URI 등록"** 섹션 찾기
   - 페이지 중간 또는 하단에 있습니다
5. **"Redirect URI 추가"** 버튼 클릭 (또는 입력 필드에 직접 입력)
6. Supabase에서 복사한 Redirect URL 입력:
   - 형식: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - 예: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
7. **"등록"** 또는 **"저장"** 버튼 클릭

## 3. 환경 변수 설정 (선택)

프로덕션 환경에서 추가 설정이 필요한 경우:

```bash
# .env.local (필요시)
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 4. 테스트

### 4.1 로컬 테스트

1. 개발 서버 실행: `npm run dev`
2. `/login` 페이지 접속
3. "카카오톡으로 로그인" 버튼 클릭
4. 카카오 로그인 화면에서 로그인
5. 리다이렉트 후 로그인 확인

### 4.2 프로덕션 테스트

1. Vercel 등에 배포
2. 카카오 개발자 센터에서 프로덕션 도메인 등록
3. Supabase에서 프로덕션 Redirect URL 확인
4. 카카오에 프로덕션 Redirect URL 등록
5. 테스트 진행

## 5. 주의사항

### 5.1 Redirect URL

- Supabase의 Redirect URL은 자동 생성되며 변경할 수 없습니다
- 카카오 개발자 센터에 정확히 등록해야 합니다
- 개발/프로덕션 환경별로 다른 Redirect URL을 등록할 수 있습니다

### 5.2 이메일 정보

- 카카오 로그인 시 이메일 정보는 선택 동의 항목입니다
- 사용자가 이메일 동의를 하지 않으면 `user.email`이 `null`일 수 있습니다
- 이 경우 `user.user_metadata.email` 또는 다른 식별자를 사용해야 합니다

### 5.3 프로필 정보

- 카카오에서 받은 사용자 정보는 `user.user_metadata`에 저장됩니다
- `name`, `email`, `avatar_url` 등의 정보를 활용할 수 있습니다

## 6. 문제 해결

### 6.1 "Invalid redirect_uri" 오류

- 카카오 개발자 센터에 등록한 Redirect URI와 Supabase의 Redirect URI가 일치하는지 확인
- 정확한 URL 형식 확인 (슬래시, 프로토콜 등)

### 6.2 "Client authentication failed" 오류

- REST API 키와 Client Secret이 정확한지 확인
- Supabase 대시보드에서 입력한 값 재확인

### 6.3 이메일이 null인 경우

- 카카오 개발자 센터에서 이메일 동의 항목 활성화
- 사용자가 이메일 동의를 했는지 확인
- `user.user_metadata.email` 또는 카카오 계정 ID 사용 고려

## 7. 추가 기능

### 7.1 프로필 사진 연동

카카오에서 받은 프로필 사진을 `profiles` 테이블에 저장하려면:

```typescript
const avatarUrl = user.user_metadata?.avatar_url;
// profiles 테이블에 avatar_url 컬럼 추가 후 저장
```

### 7.2 로그아웃 처리

카카오 로그아웃은 Supabase의 `signOut()` 메서드로 처리됩니다.
추가로 카카오 세션도 종료하려면 카카오 로그아웃 API를 호출할 수 있습니다.

## 참고 자료

- [Supabase OAuth 문서](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
- [카카오 로그인 REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [카카오 개발자 센터](https://developers.kakao.com)
