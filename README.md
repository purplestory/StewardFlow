# 교회 자원 관리 시스템 - StewardFlow

교회 내 물품, 공간, 차량을 통합 관리하고 효율적으로 공유하는 웹 플랫폼입니다.

## 주요 기능

- 📦 **물품 관리**: 교회 부서의 보유 물품을 등록하고 공유
- 🏢 **공간 관리**: 예배와 모임을 위한 공간 예약 관리
- 🚗 **차량 관리**: 교회 차량 사용 신청, 반납, 주행거리 추적
- ✅ **승인 프로세스**: 역할 기반 예약 승인 시스템
- 📸 **반납 확인**: 사진 기반 반납 검증 프로세스
- 🔔 **알림 시스템**: 예약 및 반납 관련 실시간 알림

## 기술 스택

- **Frontend**: Next.js 16.1.6, React 19.2.3, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel (Frontend), Supabase (Backend)

## 빠른 시작

### 1. 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 Supabase 키를 설정하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. 데이터베이스 마이그레이션 실행 ⚠️

**중요**: 프로젝트를 처음 실행하기 전에 반드시 [마이그레이션 체크리스트](./docs/migration_checklist.md)를 확인하고 필요한 마이그레이션을 실행하세요.

최소한 다음 마이그레이션은 실행해야 합니다:
- 카테고리 관리 기능
- 부서 순서 관리 기능
- 초대 이메일 선택사항

## 문서

### 📚 사용자 문서

- **[StewardFlow 소개](./INTRO.md)**: 기관 구성원을 위한 시스템 소개 문서 ⭐ **신규**
- **[통합 사용자 매뉴얼](./MANUAL.md)**: 모든 사용자를 위한 통합 가이드 ⭐ **최신**

### 📖 관리자/개발자 문서

- **[일반 사용자 매뉴얼](./docs/user_manual_general.md)**: 일반 사용자를 위한 사용 가이드
- **[부서 관리자 매뉴얼](./docs/user_manual_manager.md)**: 부서 관리자를 위한 관리 가이드
- **[관리자 매뉴얼](./docs/admin_manual.md)**: 관리자를 위한 시스템 관리 가이드
- **[개발 메뉴얼](./docs/development_manual.md)**: 개발자를 위한 프로젝트 설정 및 개발 가이드

### 📖 추가 문서

- [프로젝트 완성도 및 현재 상태](./docs/project_status.md) ⭐ **최신**
- [최근 변경사항](./docs/recent_changes.md) ⭐ **최신**
- [마이그레이션 체크리스트](./docs/migration_checklist.md) ⚠️ **필수 확인**
- [Vercel 배포 가이드](./docs/vercel_deployment_guide.md) 🚀 **배포 필수**
- [서비스 흐름도](./docs/service_flows.md)
- [서비스 맵](./docs/service_map.md)
- [운영 가이드](./docs/operations_guide.md)
- [카카오 OAuth 설정](./docs/kakao_oauth_setup.md)
- [Storage 정책 설정](./docs/storage_policy_setup_manual.md)

## 프로젝트 구조

```
StewardFlow/
├── src/
│   ├── app/              # Next.js App Router 페이지
│   ├── components/       # React 컴포넌트
│   ├── actions/          # Server Actions
│   ├── lib/              # 유틸리티 함수
│   └── types/            # TypeScript 타입 정의
├── supabase/
│   ├── migrations/       # 데이터베이스 마이그레이션
│   ├── schema.sql        # 스키마 정의
│   └── rls.sql           # RLS 정책
└── docs/                 # 문서
```

## 배포

### Vercel 배포

StewardFlow를 Vercel에 배포하여 웹에서 접근 가능하게 만들 수 있습니다.

**빠른 배포:**
1. GitHub 저장소에 푸시
2. Vercel에 프로젝트 연결
3. 환경 변수 설정
4. 자동 배포 완료

📖 **상세 가이드**: [Vercel 배포 가이드](./docs/vercel_deployment_guide.md)를 참고하세요.

자세한 내용은 [개발 메뉴얼](./docs/development_manual.md#배포)을 참고하세요.

## 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 문의

개발 관련 문의사항은 이슈 트래커를 이용해주세요.
