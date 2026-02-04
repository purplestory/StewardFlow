# 카카오 로그인 오류 해결 가이드

## 오류: "Unsupported provider: provider is not enabled"

이 오류는 Supabase에서 카카오 Provider가 활성화되지 않았거나 설정이 완료되지 않았을 때 발생합니다.

## 🔍 원인 확인

### 1. Supabase에서 Kakao Provider 활성화 확인

1. **Supabase 대시보드** 접속
2. **Authentication** → **Providers** 메뉴로 이동
3. **Kakao** Provider 찾기
4. **"Enable Kakao"** 토글이 **ON**인지 확인
   - OFF라면 ON으로 변경

### 2. Kakao 설정 정보 확인

Kakao Provider 설정 화면에서 다음을 확인:

- [ ] **Kakao Client ID**가 입력되어 있는지
- [ ] **Kakao Client Secret**이 입력되어 있는지
- [ ] 두 값이 비어있지 않은지
- [ ] **"Save"** 또는 **"Update settings"** 버튼을 클릭했는지

### 3. 설정 저장 확인

1. Kakao Provider 설정 화면에서
2. 모든 정보 입력 후
3. **반드시 "Save" 버튼 클릭**
4. 저장 완료 메시지 확인

## ✅ 해결 방법

### 방법 1: Kakao Provider 재설정

1. Supabase 대시보드 → Authentication → Providers
2. Kakao 찾기
3. **"Enable Kakao"** 토글을 **OFF**로 변경 → 저장
4. 잠시 기다린 후 다시 **ON**으로 변경
5. 다음 정보 다시 입력:
   - Kakao Client ID (REST API 키)
   - Kakao Client Secret
6. **"Save"** 버튼 클릭
7. 저장 완료 확인

### 방법 2: 설정 값 재확인

1. 카카오 개발자 센터에서 정보 다시 확인:
   - REST API 키: "앱 설정" → "앱 키"
   - Client Secret: "제품 설정" → "카카오 로그인" → "보안"
2. Supabase에 정확히 입력 (공백 없이)
3. 저장

### 방법 3: 브라우저 캐시 확인

1. **Supabase 대시보드** 새로고침 (F5)
2. **앱 페이지** 새로고침 (F5)
3. 필요시 강력 새로고침 (Ctrl+Shift+R 또는 Cmd+Shift+R)
4. 필요시 다른 브라우저에서 테스트

> 💡 **참고**: Supabase 설정 변경은 서버 재시작 없이 즉시 반영됩니다. 브라우저만 새로고침하면 됩니다.

## 🔍 단계별 체크리스트

### Supabase 설정 확인

- [ ] Supabase 대시보드 접속
- [ ] Authentication → Providers 메뉴로 이동
- [ ] Kakao Provider 찾기
- [ ] "Enable Kakao" 토글이 **ON**인지 확인
- [ ] Kakao Client ID가 입력되어 있는지 확인
- [ ] Kakao Client Secret이 입력되어 있는지 확인
- [ ] "Save" 버튼을 클릭했는지 확인
- [ ] 저장 완료 메시지 확인

### 카카오 개발자 센터 확인

- [ ] REST API 키가 정확한지 확인
- [ ] Client Secret이 생성되어 있는지 확인
- [ ] Client Secret이 만료되지 않았는지 확인

## ⚠️ 주의사항

### 설정 저장 필수
- 정보를 입력한 후 **반드시 "Save" 버튼을 클릭**해야 합니다
- 저장하지 않으면 설정이 적용되지 않습니다

### 값 정확성
- REST API 키와 Client Secret이 정확해야 합니다
- 공백이나 줄바꿈이 포함되지 않았는지 확인
- 카카오 개발자 센터에서 다시 복사해서 입력

### 활성화 상태
- "Enable Kakao" 토글이 **ON**이어야 합니다
- OFF 상태에서는 로그인이 작동하지 않습니다

## 🧪 테스트 방법

설정 완료 후:

1. 로컬 개발 서버 실행: `npm run dev`
2. `/login` 페이지 접속
3. "카카오톡으로 로그인" 버튼 클릭
4. 카카오 로그인 화면으로 리다이렉트되는지 확인
5. 로그인 후 다시 앱으로 돌아오는지 확인

## 📝 추가 확인 사항

### Supabase 프로젝트 상태
- Supabase 프로젝트가 활성 상태인지 확인
- 프로젝트가 일시 중지되지 않았는지 확인

### 네트워크 연결
- 인터넷 연결이 정상인지 확인
- Supabase 서비스 상태 확인

## 💡 빠른 해결

가장 빠른 해결 방법:

1. **Supabase 대시보드** → **Authentication** → **Providers**
2. **Kakao** 찾기
3. **"Enable Kakao"** 토글 확인 (ON이어야 함)
4. 설정 값 확인 및 재입력
5. **"Save"** 버튼 클릭
6. 브라우저 새로고침
7. 다시 테스트
