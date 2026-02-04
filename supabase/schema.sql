create table public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  plan text default 'basic',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  features jsonb default '{
    "equipment": true,
    "spaces": true,
    "vehicles": false
  }'::jsonb,
  menu_labels jsonb default '{
    "equipment": "물품",
    "spaces": "공간",
    "vehicles": "차량"
  }'::jsonb,
  menu_order jsonb default '[
    {"key": "equipment", "enabled": true},
    {"key": "spaces", "enabled": true},
    {"key": "vehicles", "enabled": false}
  ]'::jsonb,
  ownership_policies jsonb default '{
    "spaces": "organization_only",
    "vehicles": "organization_only"
  }'::jsonb,
  categories jsonb default '[
    {"key": "items", "label": "물품", "enabled": true},
    {"key": "spaces", "label": "공간", "enabled": true},
    {"key": "vehicles", "label": "차량", "enabled": false}
  ]'::jsonb
);

create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  organization_id uuid references public.organizations(id),
  email text not null,
  name text,
  department text,
  role text default 'manager',
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.assets (
  id uuid default gen_random_uuid() primary key,
  short_id text,
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  image_url text,
  category text,
  owner_scope text default 'department', -- 'organization' or 'department'
  owner_department text not null,
  location text,
  quantity integer default 1,
  status text default 'available',
  shopping_link text,
  ai_metadata jsonb,
  is_verified boolean default false,
  tags text[] default '{}',
  purchase_date date,
  purchase_price integer,
  useful_life_years integer,
  last_used_at timestamp with time zone,
  mobility text default 'movable', -- 'fixed' or 'movable'
  loanable boolean default true,
  usable_until date,
  managed_by_department text
);

-- Create unique index on short_id for fast lookups
create unique index if not exists idx_assets_short_id 
on public.assets(short_id) 
where short_id is not null;

-- Create index on organization_id and short_id for organization-scoped lookups
create index if not exists idx_assets_org_short_id 
on public.assets(organization_id, short_id) 
where short_id is not null;

create table public.asset_transfer_requests (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  asset_id uuid references public.assets(id),
  requester_id uuid references public.profiles(id),
  from_department text,
  to_department text,
  status text default 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone
);

create table public.spaces (
  id uuid default gen_random_uuid() primary key,
  short_id text,
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  image_url text,
  category text,
  owner_scope text default 'organization', -- 'organization' or 'department'
  owner_department text not null,
  location text,
  capacity integer,
  status text default 'available',
  note text,
  managed_by_department text
);

-- Create unique index on short_id for fast lookups
create unique index if not exists idx_spaces_short_id 
on public.spaces(short_id) 
where short_id is not null;

-- Create index on organization_id and short_id for organization-scoped lookups
create index if not exists idx_spaces_org_short_id 
on public.spaces(organization_id, short_id) 
where short_id is not null;

create table public.reservations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  asset_id uuid references public.assets(id) not null,
  borrower_id uuid references public.profiles(id) not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  status text default 'pending',
  note text,
  recurrence_type text default 'none', -- 'none', 'weekly', 'monthly'
  recurrence_interval integer default 1, -- 몇 주/달마다 반복
  recurrence_end_date timestamp with time zone, -- 반복 종료일
  recurrence_days_of_week integer[], -- 요일 배열 (0=일요일, 1=월요일, ..., 6=토요일)
  recurrence_day_of_month integer, -- 월의 몇 일 (1-31)
  parent_reservation_id uuid references public.reservations(id), -- 원본 예약 ID
  is_recurring_instance boolean default false -- 반복 일정의 인스턴스인지 여부
);

create table public.space_reservations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  space_id uuid references public.spaces(id) not null,
  borrower_id uuid references public.profiles(id) not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  status text default 'pending',
  note text,
  recurrence_type text default 'none', -- 'none', 'weekly', 'monthly'
  recurrence_interval integer default 1, -- 몇 주/달마다 반복
  recurrence_end_date timestamp with time zone, -- 반복 종료일
  recurrence_days_of_week integer[], -- 요일 배열 (0=일요일, 1=월요일, ..., 6=토요일)
  recurrence_day_of_month integer, -- 월의 몇 일 (1-31)
  parent_reservation_id uuid references public.space_reservations(id), -- 원본 예약 ID
  is_recurring_instance boolean default false -- 반복 일정의 인스턴스인지 여부
);

create table public.vehicles (
  id uuid default gen_random_uuid() primary key,
  short_id text,
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  image_url text,
  image_urls text[] default '{}',
  category text,
  owner_scope text default 'organization', -- 'organization' or 'department'
  owner_department text not null,
  location text,
  status text default 'available', -- 'available', 'rented', 'repair', 'lost'
  note text,
  managed_by_department text,
  license_plate text, -- 차량 번호판
  vehicle_type text, -- 차종 (승용차, 승합차, 트럭 등)
  fuel_type text, -- 연료 타입 (가솔린, 디젤, 전기, 하이브리드 등)
  capacity integer -- 탑승 인원
);

-- Create unique index on short_id for fast lookups
create unique index if not exists idx_vehicles_short_id 
on public.vehicles(short_id) 
where short_id is not null;

-- Create index on organization_id and short_id for organization-scoped lookups
create index if not exists idx_vehicles_org_short_id 
on public.vehicles(organization_id, short_id) 
where short_id is not null;

create table public.vehicle_reservations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  vehicle_id uuid references public.vehicles(id) not null,
  borrower_id uuid references public.profiles(id) not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  status text default 'pending',
  note text,
  recurrence_type text default 'none', -- 'none', 'weekly', 'monthly'
  recurrence_interval integer default 1, -- 몇 주/달마다 반복
  recurrence_end_date timestamp with time zone, -- 반복 종료일
  recurrence_days_of_week integer[], -- 요일 배열 (0=일요일, 1=월요일, ..., 6=토요일)
  recurrence_day_of_month integer, -- 월의 몇 일 (1-31)
  parent_reservation_id uuid references public.vehicle_reservations(id), -- 원본 예약 ID
  is_recurring_instance boolean default false -- 반복 일정의 인스턴스인지 여부
);

create table public.approval_policies (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  scope text not null, -- 'asset', 'space', or 'vehicle'
  department text,
  required_role text default 'manager',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  user_id uuid references public.profiles(id),
  channel text default 'kakao',
  type text not null,
  status text default 'pending', -- 'pending', 'sent', 'failed'
  payload jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.organization_invites (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  email text not null,
  role text default 'user',
  token text unique,
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.departments (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(organization_id, name)
);

create index idx_departments_organization_id
  on public.departments(organization_id);
