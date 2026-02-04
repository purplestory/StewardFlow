# ⛪ Steward Flow Design Document

## 1. 프로젝트 개요 (Overview)
* **목표:** 교회 내 여러 교육부서(유년부, 중고등부, 청년부 등)가 보유한 자산(음향, 영상, 조리도구 등)을 통합 관리하고, 유휴 물품을 서로 대여할 수 있는 웹 플랫폼 구축.
* **핵심 가치:** 1.  **자산 가시화:** 어디에 무엇이 있는지 한눈에 파악.
    2.  **모바일 편의성:** 현장에서 스마트폰으로 사진을 찍어 즉시 등록.
    3.  **확장성:** 추후 AI를 활용한 자산 정보 자동 정제 및 스펙 업데이트.

## 2. 기술 스택 (Tech Stack)
* **Frontend:** Next.js 14+ (App Router), React, TypeScript
* **Styling:** Tailwind CSS, shadcn/ui (UI Components), Lucide React (Icons)
* **Backend & Database:** Supabase (PostgreSQL, Auth, Storage, Realtime)
* **Deployment:** Vercel (Frontend), Supabase (Backend)
* **AI/Automation (Future):** Next.js API Routes + OpenAI API (or Cheerio for scraping)

## 3. 데이터베이스 스키마 (Database Schema)
Supabase의 PostgreSQL을 사용합니다. 아래 SQL을 SQL Editor에서 실행하여 테이블을 생성합니다.

### 3.1. Tables

#### `profiles` (사용자/부서 정보)
Supabase Auth의 `auth.users`와 연동되는 테이블입니다.
```sql
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  name text, -- 담당자 이름 (예: 김철수)
  department text, -- 소속 부서 (예: 유년부, 방송팀)
  role text default 'manager', -- 'admin' (전체관리), 'manager' (부서관리), 'user' (대여만)
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

```

#### `assets` (자산 정보)

```sql
create table public.assets (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null, -- 제품명 (초기 입력값)
  image_url text, -- Supabase Storage Public URL
  category text, -- 'sound', 'video', 'kitchen', 'furniture', 'etc'
  owner_department text not null, -- 소유 부서 (profiles.department 와 매핑)
  location text, -- 보관 장소 상세 (예: 비전홀 3층 창고)
  quantity integer default 1,
  status text default 'available', -- 'available', 'rented', 'repair', 'lost'
  shopping_link text, -- 구매 링크 (AI 분석용 원천 데이터)
  ai_metadata jsonb, -- AI가 긁어온 상세 스펙 (제조사, 모델명, 최저가 등) 저장용
  is_verified boolean default false -- 관리자/AI 검수 완료 여부
);

```

#### `reservations` (대여 기록)

```sql
create table public.reservations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  asset_id uuid references public.assets(id) not null,
  borrower_id uuid references public.profiles(id) not null, -- 빌리는 사람
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  status text default 'pending', -- 'pending' (승인대기), 'approved' (승인됨), 'returned' (반납완료), 'rejected'
  note text -- 사용 목적 등 비고
);

```

### 3.2. Storage Buckets

* Bucket Name: `asset-images`
* Policy: Public Access (Anyone can read), Authenticated users can upload.

## 4. 폴더 구조 (Directory Structure)

Next.js App Router 기반의 구조입니다.

```
steward-flow/
├── public/                 # 정적 파일
├── src/
│   ├── app/                # App Router 페이지
│   │   ├── layout.tsx      # 전체 레이아웃 (네비게이션 바 포함)
│   │   ├── page.tsx        # 메인 페이지 (자산 검색/목록)
│   │   ├── login/          # 로그인 페이지
│   │   ├── assets/
│   │   │   ├── new/        # 자산 등록 페이지 (모바일 최적화)
│   │   │   ├── [id]/       # 자산 상세 페이지 (대여 신청)
│   │   │   └── manage/     # 내 부서 자산 관리 페이지
│   │   └── my/             # 마이페이지 (내 대여 기록)
│   ├── components/         # UI 컴포넌트
│   │   ├── ui/             # shadcn/ui 컴포넌트들
│   │   ├── assets/         # AssetCard, AssetForm 등
│   │   └── layout/         # Header, Footer, Sidebar
│   ├── lib/
│   │   ├── supabase.ts     # Supabase Client 설정
│   │   └── utils.ts        # 유틸리티 함수
│   ├── types/              # TypeScript 타입 정의 (Database DTO)
│   └── actions/            # Server Actions (DB조작 로직)
│       ├── asset-actions.ts
│       └── booking-actions.ts
├── .env.local              # 환경변수 (Supabase Keys)
├── next.config.js
└── tailwind.config.ts

```

## 5. 핵심 기능별 구현 가이드 (Implementation Guide)

### Phase 1: 자산 등록 (Inventory Build-up)

**목표:** 각 부서 담당자들이 스마트폰으로 쉽게 물건을 등록하게 한다.

1. **UI:** 모바일 뷰포트 우선 설계. `input type="file" capture="environment"` 속성을 활용해 카메라 바로 실행.
2. **Logic:**
* 사용자가 로그인 상태인지 확인.
* 사진 업로드 -> Supabase Storage 저장 -> Public URL 획득.
* DB Insert: 제품명, URL, 사진주소 저장. (소유 부서는 로그인 유저 정보에서 자동 추출)


3. **Tip:** `shopping_link` 입력 필드는 선택 사항으로 두되, 입력 시 "나중에 자동으로 정보가 채워집니다"라고 안내.

### Phase 2: 대여 및 예약 (Booking System)

**목표:** 중복 예약을 방지하고 대여 프로세스를 관리한다.

1. **Calendar UI:** `react-calendar` 또는 `FullCalendar` 라이브러리 활용.
2. **Conflict Check:** 예약 신청 시, 해당 `asset_id`가 요청된 날짜 범위(`start_date` ~ `end_date`)에 이미 `reservations` 테이블에 존재하는지 쿼리로 확인.
3. **Status Flow:** 신청(pending) -> (옵션: 부서장 승인) -> 확정(approved) -> 반납(returned).

### Phase 3: AI 데이터 정제 (AI Automation)

**목표:** URL만 있는 데이터의 상세 정보를 AI로 채운다.

1. **Trigger:** 관리자 페이지에서 '정보 업데이트' 버튼 클릭.
2. **Process:**
* Next.js API Route (`/api/enrich-asset`) 호출.
* 서버에서 해당 URL의 HTML 메타데이터(OG Tag)를 스크래핑하거나, OpenAI API에 HTML 텍스트 일부를 던져서 JSON 추출 요청.
* 추출된 데이터(정식 모델명, 제조사 등)를 `assets` 테이블의 `ai_metadata` 컬럼에 업데이트.



## 6. 개발 로드맵 (Roadmap)

* **1주차:** 프로젝트 세팅, Supabase DB 구축, 로그인/회원가입(부서 선택) 구현.
* **2주차:** 자산 등록 페이지(사진 업로드), 전체 자산 리스트 뷰(카드 형태) 구현.
* **3주차:** 자산 상세 페이지, 대여 신청 기능, 마이페이지(내 신청 현황).
* **4주차:** 디자인 폴리싱, 배포(Vercel), AI 자동 입력 기능 테스트.

## 7. 환경 변수 설정 (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL="[https://your-project.supabase.co](https://your-project.supabase.co)"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

```

```

***

### 💡 활용 팁
1.  위 내용을 복사해서 VS Code 프로젝트 최상단에 `design_doc.md` 파일을 만들고 붙여넣으세요.
2.  개발하다가 테이블 구조가 헷갈리거나 다음 스텝이 고민될 때 열어보시면 됩니다.
3.  AI 코딩 도구(Cursor, GitHub Copilot 등)를 쓰실 때, **"이 `design_doc.md`를 참고해서 자산 등록 페이지 코드를 짜줘"**라고 하면 훨씬 정확한 코드를 만들어줍니다.

```
