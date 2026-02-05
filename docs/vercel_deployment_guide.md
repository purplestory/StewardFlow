# Vercel 배포 가이드

Steward Flow를 Vercel에 배포하여 웹에서 접근 가능하게 만드는 방법입니다.

## 사전 준비사항

1. **GitHub 계정** 및 저장소
2. **Vercel 계정** ([vercel.com](https://vercel.com)에서 무료 가입)
3. **Supabase 프로젝트** (이미 설정되어 있어야 함)

## 배포 단계

### 1단계: GitHub에 코드 푸시

```bash
# 현재 디렉토리에서
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main  # 또는 master
```

> 💡 **참고**: 아직 Git 저장소가 없다면:
> ```bash
> git init
> git remote add origin <your-github-repo-url>
> git add .
> git commit -m "Initial commit"
> git push -u origin main
> ```

### 2단계: Vercel에 프로젝트 연결

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인
2. **"Add New..." → "Project"** 클릭
3. GitHub 저장소 선택 또는 **"Import Git Repository"** 클릭
4. 저장소 선택 후 **"Import"** 클릭

### 3단계: 프로젝트 설정

Vercel이 자동으로 Next.js 프로젝트를 감지합니다. 다음 설정을 확인하세요:

- **Framework Preset**: Next.js (자동 감지)
- **Root Directory**: `./` (기본값)
- **Build Command**: `npm run build` (자동 설정)
- **Output Directory**: `.next` (자동 설정)
- **Install Command**: `npm install` (자동 설정)

### 4단계: 환경 변수 설정 ⚠️ 중요

**Settings → Environment Variables**에서 다음 변수들을 추가하세요:

#### 필수 환경 변수

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 환경 변수 설정 방법

**단계별 가이드:**

1. **Vercel 프로젝트 대시보드 접속**
   - [vercel.com/dashboard](https://vercel.com/dashboard)에 로그인
   - 배포한 프로젝트 클릭

2. **Settings 메뉴로 이동**
   - 프로젝트 페이지 상단의 **"Settings"** 탭 클릭
   - 또는 프로젝트 목록에서 프로젝트 옆 **"..."** 메뉴 → **"Settings"** 선택

3. **Environment Variables 섹션 찾기**
   - 왼쪽 사이드바에서 **"Environment Variables"** 클릭
   - 또는 Settings 페이지에서 스크롤하여 **"Environment Variables"** 섹션 찾기

4. **환경 변수 추가**
   - **"Add New"** 또는 **"Add Environment Variable"** 버튼 클릭
   - 각 변수를 하나씩 추가:

   **첫 번째 변수: `NEXT_PUBLIC_SUPABASE_URL`**
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Supabase 프로젝트 URL (예: `https://xxxxx.supabase.co`)
   - **Environment**: 
     - ✅ `Production` 체크
     - ✅ `Preview` 체크 (선택사항이지만 권장)
     - ❌ `Development`는 체크하지 않음 (로컬에서만 사용)
   - **"Save"** 클릭

   **두 번째 변수: `NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Supabase `anon public` 키
   - **Environment**: 
     - ✅ `Production` 체크
     - ✅ `Preview` 체크
   - **"Save"** 클릭

   **세 번째 변수: `SUPABASE_SERVICE_ROLE_KEY`**
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Supabase `service_role` 키 (⚠️ 보안 주의)
   - **Environment**: 
     - ✅ `Production` 체크
     - ✅ `Preview` 체크
   - **"Save"** 클릭

5. **환경 변수 확인**
   - 추가한 변수들이 목록에 표시되는지 확인
   - 각 변수의 Environment 설정이 올바른지 확인

> 💡 **Supabase 키 확인 방법**:
> 
> 1. **Supabase 대시보드 접속**
>    - [supabase.com/dashboard](https://supabase.com/dashboard)에 로그인
>    - 프로젝트 선택
> 
> 2. **API 설정 페이지로 이동**
>    - 왼쪽 사이드바에서 **"Project Settings"** (⚙️ 아이콘) 클릭
>    - **"API"** 메뉴 클릭
> 
> 3. **키 복사**
>    - **Project URL**: `https://xxxxx.supabase.co` 형식
>      - `NEXT_PUBLIC_SUPABASE_URL`에 사용
>    - **anon public** 키: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` 형식
>      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 사용
>    - **service_role** 키: **"Reveal"** 버튼 클릭하여 표시
>      - `SUPABASE_SERVICE_ROLE_KEY`에 사용
>      - ⚠️ **주의**: 이 키는 서버 사이드에서만 사용하며, 클라이언트에 노출되면 안 됩니다!
> 
> 4. **키 복사 팁**
>    - 각 키 옆의 **복사 아이콘** (📋) 클릭하여 복사
>    - 전체 키를 정확히 복사했는지 확인 (매우 긴 문자열입니다)

### 5단계: 배포 실행

환경 변수 설정 후:

1. **"Deployments"** 탭으로 이동
2. **"Redeploy"** 버튼 클릭 (또는 자동 배포 대기)
3. 배포 완료까지 2-5분 소요

### 6단계: 배포 URL 확인

배포 완료 후:
- **"Deployments"** 탭에서 배포 상태 확인
- 배포된 URL은 `https://your-project.vercel.app` 형식
- 클릭하여 사이트 접속 확인

## 프로덕션 설정

### 카카오 OAuth Redirect URI 설정

프로덕션 URL이 생성되면 카카오 개발자 센터에서 Redirect URI를 추가해야 합니다:

1. [카카오 개발자 센터](https://developers.kakao.com) 접속
2. 앱 선택 → **"제품 설정" → "카카오 로그인"** 클릭
3. **"Redirect URI 등록"** 섹션에서 추가:
   ```
   https://your-project.vercel.app/auth/callback
   ```
4. **Supabase 콜백 URI**도 확인:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
5. 저장

### Supabase 프로덕션 URL 허용

Supabase에서 프로덕션 URL을 허용해야 합니다:

1. Supabase 대시보드 접속
2. **Project Settings → Authentication → URL Configuration**
3. **"Site URL"**에 Vercel 배포 URL 추가:
   ```
   https://your-project.vercel.app
   ```
4. **"Redirect URLs"**에 추가:
   ```
   https://your-project.vercel.app/auth/callback
   ```
5. 저장

## 커스텀 도메인 설정 (선택사항)

### 도메인 추가

1. Vercel 프로젝트 → **"Settings" → "Domains"**
2. 원하는 도메인 입력 (예: `steward.yourchurch.com`)
3. DNS 설정 안내에 따라 도메인 제공업체에서 DNS 레코드 추가
4. 인증 완료까지 몇 분~24시간 소요

### 도메인 설정 후

도메인 설정 후 카카오 OAuth와 Supabase 설정도 업데이트해야 합니다:
- 카카오 Redirect URI에 새 도메인 추가
- Supabase Site URL 및 Redirect URLs에 새 도메인 추가

## 자동 배포 설정

### GitHub 브랜치별 배포

- **`main` (또는 `master`) 브랜치**: 프로덕션 배포
- **다른 브랜치**: 프리뷰 배포 (자동 생성)

### 배포 알림

- Vercel은 GitHub에 배포 상태를 자동으로 업데이트합니다
- 배포 실패 시 이메일 알림을 받을 수 있습니다 (설정에서 활성화)

## 문제 해결

### 빌드 실패

**원인**: 환경 변수 누락 또는 빌드 오류

**해결**:
1. **"Deployments"** 탭에서 실패한 배포 클릭
2. 빌드 로그 확인
3. 환경 변수 확인 (Settings → Environment Variables)
4. 로컬에서 `npm run build` 실행하여 오류 확인

### 인증 오류

**원인**: Supabase URL 또는 키가 잘못됨

**해결**:
1. 환경 변수 재확인
2. Supabase 대시보드에서 키 재확인
3. 프로덕션 URL이 Supabase에 등록되었는지 확인

### 카카오 로그인 실패

**원인**: Redirect URI가 등록되지 않음

**해결**:
1. 카카오 개발자 센터에서 Redirect URI 확인
2. 프로덕션 URL이 정확히 등록되었는지 확인
3. Supabase 콜백 URI도 등록되어 있는지 확인

### 이미지 업로드 실패

**원인**: Supabase Storage 정책 미설정

**해결**:
1. [Storage 정책 설정 가이드](./storage_policy_setup_manual.md) 참고
2. Supabase Storage에서 버킷 및 정책 확인

## 배포 후 체크리스트

배포 후 다음 항목들을 확인하세요:

- [ ] 홈페이지 접속 확인
- [ ] 카카오 로그인 테스트
- [ ] 자원 목록 조회 테스트
- [ ] 자원 등록 테스트 (이미지 업로드 포함)
- [ ] 예약 신청 테스트
- [ ] 알림 기능 테스트
- [ ] 모바일 반응형 확인

## 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Supabase 프로덕션 가이드](https://supabase.com/docs/guides/hosting/overview)

---

**문의**: 배포 관련 문제가 있으면 이슈 트래커를 이용해주세요.
