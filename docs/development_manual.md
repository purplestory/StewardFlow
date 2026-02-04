# Steward Flow - 개발 메뉴얼

## 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [환경 설정](#환경-설정)
3. [프로젝트 구조](#프로젝트-구조)
4. [데이터베이스 설정](#데이터베이스-설정)
5. [개발 서버 실행](#개발-서버-실행)
6. [주요 기능 구현](#주요-기능-구현)
7. [배포](#배포)
8. [문제 해결](#문제-해결)

---

## 프로젝트 개요

**교회 자원 관리 시스템 - Steward Flow**는 교회 내 물품, 공간, 차량을 통합 관리하고 효율적으로 공유하는 웹 플랫폼입니다.

### 기술 스택
- **Frontend**: Next.js 16.1.6 (App Router), React 19.2.3, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: Vercel (Frontend), Supabase (Backend)

### 주요 기능
- 물품/공간/차량 등록 및 관리
- 예약 시스템 (일회성 및 반복 예약)
- 승인 프로세스 (역할 기반)
- 반납 확인 (사진 및 검증)
- 주행거리 추적 (차량)
- 부서별 자원 관리
- 알림 시스템

---

## 환경 설정

### 1. 필수 요구사항
- Node.js 20.x 이상
- npm, yarn, pnpm 또는 bun
- Git

### 2. 프로젝트 클론 및 설치

```bash
# 저장소 클론
git clone <repository-url>
cd StewardFlow

# 의존성 설치
npm install
# 또는
yarn install
# 또는
pnpm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정합니다:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase 서버 키 (서버 사이드에서만 사용)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Supabase 키 확인 방법:**
1. Supabase 대시보드 접속
2. Project Settings > API 메뉴
3. `Project URL`과 `anon public` 키 복사

---

## 프로젝트 구조

```
StewardFlow/
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── page.tsx           # 홈페이지 (플랫폼 소개)
│   │   ├── login/             # 로그인 페이지
│   │   ├── assets/            # 물품 관련 페이지
│   │   │   ├── page.tsx       # 물품 목록
│   │   │   ├── new/           # 물품 등록
│   │   │   ├── [id]/          # 물품 상세
│   │   │   │   └── edit/      # 물품 수정
│   │   │   └── manage/        # 물품 관리
│   │   ├── spaces/            # 공간 관련 페이지
│   │   ├── vehicles/          # 차량 관련 페이지
│   │   ├── my/                # 마이페이지
│   │   ├── manage/            # 통합 관리 페이지
│   │   ├── settings/           # 설정 페이지
│   │   │   ├── users/         # 사용자 관리
│   │   │   ├── org/           # 기관 설정
│   │   │   ├── menu/          # 메뉴 설정
│   │   │   └── audit/         # 감사 로그
│   │   └── api/               # API 라우트
│   ├── components/            # React 컴포넌트
│   │   ├── assets/            # 물품 관련 컴포넌트
│   │   ├── spaces/            # 공간 관련 컴포넌트
│   │   ├── vehicles/          # 차량 관련 컴포넌트
│   │   ├── manage/            # 관리 컴포넌트
│   │   ├── settings/          # 설정 컴포넌트
│   │   ├── layout/            # 레이아웃 컴포넌트
│   │   └── common/            # 공통 컴포넌트
│   ├── actions/               # Server Actions
│   │   ├── asset-actions.ts
│   │   ├── space-actions.ts
│   │   ├── vehicle-actions.ts
│   │   ├── booking-actions.ts
│   │   ├── approval-actions.ts
│   │   └── invite-actions.ts
│   ├── lib/                   # 유틸리티 함수
│   │   ├── supabase.ts        # Supabase 클라이언트
│   │   ├── supabase-server.ts # 서버 사이드 Supabase
│   │   ├── utils.ts
│   │   ├── short-id.ts        # 짧은 ID 생성
│   │   └── recurrence.ts      # 반복 예약 로직
│   └── types/                 # TypeScript 타입 정의
│       └── database.ts
├── supabase/
│   ├── migrations/            # 데이터베이스 마이그레이션
│   ├── schema.sql             # 스키마 정의
│   ├── rls.sql                # RLS 정책
│   └── scripts/               # 유틸리티 스크립트
├── public/                    # 정적 파일
├── docs/                      # 문서
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 데이터베이스 설정

### 1. Supabase 프로젝트 생성
1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 URL과 API 키 확인

### 2. 마이그레이션 실행

Supabase SQL Editor에서 다음 순서로 마이그레이션을 실행합니다:

```bash
# 1. 기본 스키마 생성
# supabase/schema.sql 실행

# 2. RLS 정책 설정
# supabase/rls.sql 실행

# 3. 마이그레이션 파일 순차 실행
# supabase/migrations/ 폴더의 파일들을 날짜 순서대로 실행
```

**주의사항:**
- 마이그레이션은 순서대로 실행해야 합니다
- 이미 실행된 마이그레이션은 다시 실행하지 마세요
- 프로덕션 환경에서는 백업 후 실행하세요

### 3. Storage 버킷 생성

Supabase Dashboard > Storage에서 다음 버킷을 생성합니다:

- **버킷명**: `asset-images`
- **Public**: Yes
- **File size limit**: 10MB (필요시 조정)
- **Allowed MIME types**: `image/*`

### 4. Storage 정책 설정

`docs/storage_policy_setup_manual.md` 파일을 참고하여 Storage 정책을 설정합니다.

### 5. 카카오 OAuth 설정 (선택사항)

카카오톡 로그인을 사용하려면:
1. [Kakao Developers](https://developers.kakao.com)에서 앱 생성
2. Redirect URI 설정: `https://your-project.supabase.co/auth/v1/callback`
3. Supabase Dashboard > Authentication > Providers > Kakao 설정
4. `docs/kakao_oauth_setup.md` 참고

---

## 개발 서버 실행

### 개발 모드

```bash
npm run dev
# 또는
yarn dev
# 또는
pnpm dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다.

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

### 린트 검사

```bash
npm run lint
```

---

## 주요 기능 구현

### 1. 인증 시스템

**파일**: `src/lib/supabase.ts`, `src/lib/supabase-server.ts`

- 클라이언트 사이드: `supabase.auth.getSession()`
- 서버 사이드: `createSupabaseServerClient()`
- 미들웨어: `src/middleware.ts`에서 세션 확인

### 2. 자원 등록

**물품 등록**: `src/components/assets/AssetForm.tsx`
**공간 등록**: `src/components/spaces/SpaceForm.tsx`
**차량 등록**: `src/components/vehicles/VehicleForm.tsx`

**주요 기능:**
- 이미지 업로드 (Supabase Storage)
- 부서별 소유권 설정
- 카테고리 분류

### 3. 예약 시스템

**파일**: `src/components/assets/ReservationForm.tsx`

**주요 기능:**
- 일회성 예약
- 반복 예약 (매일/매주/매월)
- 승인 프로세스 연동
- 주행거리 입력 (차량)

### 4. 승인 프로세스

**파일**: `src/components/manage/ReservationManager.tsx`

**승인 정책 확인:**
1. 예약 대상의 소유 정보 확인
2. 해당 부서/기관의 승인 정책 조회
3. 사용자 역할과 정책 비교
4. 승인 권한 여부 결정

### 5. 반납 확인

**파일**: 
- `src/components/returns/ReturnForm.tsx` (일반)
- `src/components/returns/VehicleReturnForm.tsx` (차량)
- `src/components/returns/ReturnVerificationForm.tsx` (검증)

**주요 기능:**
- 반납 사진 업로드
- 차량: 계기판 사진, 외관 사진, 주행거리 입력
- 관리자 검증 프로세스

### 6. 알림 시스템

**파일**: `src/components/notifications/NotificationsList.tsx`

**알림 유형:**
- 예약 승인 요청
- 예약 승인/거부
- 반납 요청
- 반납 검증 완료

---

## 배포

### 1. Vercel 배포

> 📖 **상세 가이드**: [Vercel 배포 가이드](./vercel_deployment_guide.md)를 참고하세요.

**빠른 배포:**
1. GitHub 저장소에 푸시
2. Vercel에 프로젝트 연결
3. 환경 변수 설정
4. 자동 배포 완료

**환경 변수 설정:**
- Vercel Dashboard > Settings > Environment Variables
- `.env.local`의 모든 변수 추가:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

**수동 배포 (CLI):**
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel
```

### 2. Supabase 배포

- 데이터베이스 마이그레이션은 Supabase Dashboard에서 실행
- Storage 정책은 SQL Editor에서 실행

### 3. 도메인 설정

1. Vercel에서 Custom Domain 추가
2. DNS 설정 (CNAME 또는 A 레코드)
3. SSL 인증서 자동 발급

---

## 문제 해결

### 1. 인증 오류

**문제**: 로그인 후 세션이 유지되지 않음

**해결**:
- `src/middleware.ts` 확인
- Supabase Auth 설정 확인
- 쿠키 도메인 설정 확인

### 2. RLS 정책 오류

**문제**: 데이터 조회/수정 권한 오류

**해결**:
- `supabase/rls.sql` 재실행
- 사용자 역할 확인 (`profiles.role`)
- 정책 조건 확인

### 3. 이미지 업로드 실패

**문제**: Storage 업로드 오류

**해결**:
- Storage 버킷 존재 확인
- Storage 정책 확인
- 파일 크기 제한 확인

### 4. 마이그레이션 오류

**문제**: 테이블이 이미 존재함

**해결**:
- `IF NOT EXISTS` 구문 사용
- 조건부 마이그레이션 로직 확인
- `supabase/migrations/20260204_add_return_verification.sql` 참고

### 5. 타입 오류

**문제**: TypeScript 타입 오류

**해결**:
- `src/types/database.ts` 확인
- Supabase 타입 재생성 (필요시)
- `npm run build`로 타입 체크

---

## 추가 리소스

- [Next.js 문서](https://nextjs.org/docs)
- [Supabase 문서](https://supabase.com/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [프로젝트 문서](./README.md)

---

## 개발 가이드라인

### 코드 스타일
- TypeScript 사용 필수
- 함수형 컴포넌트 사용
- Server Actions는 `src/actions/`에 위치
- 공통 컴포넌트는 `src/components/common/`에 위치

### 커밋 메시지
- 명확하고 간결하게 작성
- 기능 추가: `feat: 물품 등록 기능 추가`
- 버그 수정: `fix: 예약 승인 오류 수정`
- 문서: `docs: 개발 메뉴얼 추가`

### 테스트
- 주요 기능은 수동 테스트 필수
- 프로덕션 배포 전 스테이징 환경에서 테스트

---

**문의**: 개발 관련 문의사항은 이슈 트래커를 이용해주세요.
