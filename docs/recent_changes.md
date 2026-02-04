# 최근 변경사항 상세 기록

## 2025년 2월 8일

### 드래그앤드롭 기능 추가

#### 카테고리 순서 변경
- **파일**: `src/components/settings/AssetCategoryManager.tsx`
- **기능**: 카테고리 목록을 드래그앤드롭으로 순서 변경
- **저장 위치**: `organizations.asset_categories` JSONB 배열
- **마이그레이션**: `supabase/migrations/20260208_add_asset_categories.sql`

#### 메뉴 순서 변경
- **파일**: `src/components/settings/FeatureSettings.tsx`
- **기능**: 메뉴 항목을 드래그앤드롭으로 순서 변경
- **저장 위치**: `organizations.menu_order` JSONB 배열
- **기존 기능**: 이미 존재하던 컬럼 활용

#### 부서 순서 변경
- **파일**: `src/components/settings/DepartmentManager.tsx`
- **기능**: 부서 목록을 드래그앤드롭으로 순서 변경
- **저장 위치**: `organizations.department_order` JSONB 배열
- **마이그레이션**: `supabase/migrations/20260208_add_department_order.sql`
- **적용 위치**: 
  - 부서 관리 페이지
  - 사용자 초대 페이지의 부서 선택 드롭다운

### 초대 링크 생성 개선

#### 문제 해결
- **문제**: API 라우트에서 세션 확인 실패 (401 Unauthorized)
- **해결**: 클라이언트에서 직접 Supabase 클라이언트 사용
- **파일**: `src/components/settings/UserRoleManager.tsx`
- **변경사항**:
  - API 라우트 호출 제거
  - `generateShortId` 직접 호출
  - `supabase.from("organization_invites").insert()` 직접 사용

#### 이메일 선택사항 지원
- **문제**: `organization_invites.email` 컬럼이 NOT NULL
- **해결**: 컬럼을 nullable로 변경
- **마이그레이션**: `supabase/migrations/20260208_make_invite_email_nullable.sql`

### UI 통일성 개선

#### 버튼 스타일 통일
- **파일**: `src/app/globals.css`
- **변경사항**:
  - 모든 버튼 높이 `h-10`으로 통일
  - 패딩 `px-4`로 통일
  - `whitespace-nowrap` 추가 (텍스트 줄바꿈 방지)

#### 폼 높이 통일
- **파일**: `src/app/globals.css`
- **변경사항**:
  - `.form-input`, `.form-select` 높이 `h-10`으로 통일
  - 기존 `h-12`에서 변경

#### 라벨 스타일 통일
- **파일**: `src/app/globals.css`
- **변경사항**:
  - `.form-label` 클래스 정의
  - `mb-1.5` 제거 (컨테이너 `gap-2` 사용)
  - 모든 폼 라벨에 `form-label` 클래스 적용

### 텍스트 표시 개선

#### 줄바꿈 지원
- **파일**: 
  - `src/components/spaces/SpaceDetailClient.tsx`
  - `src/components/vehicles/VehicleDetailClient.tsx`
- **변경사항**: 비고 필드에 `whitespace-pre-wrap` 클래스 추가

### 메뉴 구조 개선

#### 관리페이지 추가
- **파일**: `src/app/manage/page.tsx`
- **기능**: 자원관리, 사용자관리, 메뉴관리, 시스템설정 카드 레이아웃
- **접근**: 사용자 드롭다운 메뉴에서 "관리페이지" 선택

#### 탑 메뉴 정리
- **파일**: `src/components/layout/Header.tsx`
- **변경사항**: "관리" 드롭다운 제거, "관리페이지"로 통합

## 주요 버그 수정

### 이미지 업로드
- **문제**: 파일 선택 후 미리보기 및 업로드 실패
- **해결**: blob URL 즉시 생성, `useRef`로 파일 다이얼로그 제어

### 폼 리셋 오류
- **문제**: `null is not an object (evaluating 'event.currentTarget.reset')`
- **해결**: `event.currentTarget`을 변수에 저장 후 null 체크

### 삭제 모달
- **문제**: 삭제 후 모달이 닫히지 않음, "기타" 입력 불가
- **해결**: 상태 리셋 추가, 별도 입력 필드 추가

### 세션 확인
- **문제**: 서버 액션에서 세션 확인 실패
- **해결**: `getSession()`과 `getUser()` fallback 로직 추가

## 코드 품질 개선

### 에러 처리 강화
- 모든 서버 액션에 상세한 에러 로깅 추가
- 사용자 친화적인 에러 메시지 제공
- 스키마 오류 시 마이그레이션 안내

### 타입 안정성
- TypeScript 타입 정의 개선
- null 체크 강화
- 옵셔널 체이닝 적극 활용

## 성능 개선

### 불필요한 리렌더링 방지
- `useMemo` 활용
- `useRef`로 불필요한 상태 업데이트 방지
- 이벤트 핸들러 최적화

## 문서화

### 새로 추가된 문서
- `docs/project_status.md`: 프로젝트 완성도 및 현재 상태
- `docs/recent_changes.md`: 최근 변경사항 상세 기록

### 업데이트된 문서
- README.md: 프로젝트 구조 및 빠른 시작 가이드
