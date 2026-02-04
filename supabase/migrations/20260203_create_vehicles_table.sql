-- Create vehicles table
create table if not exists public.vehicles (
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

-- Create vehicle_reservations table
create table if not exists public.vehicle_reservations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  vehicle_id uuid references public.vehicles(id) not null,
  borrower_id uuid references public.profiles(id) not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  status text default 'pending',
  note text,
  recurrence_type text default 'none',
  recurrence_interval integer default 1,
  recurrence_end_date timestamp with time zone,
  recurrence_days_of_week integer[],
  recurrence_day_of_month integer,
  parent_reservation_id uuid references public.vehicle_reservations(id),
  is_recurring_instance boolean default false
);

-- Migrate existing image_url to image_urls array for vehicles (if any exist)
update public.vehicles
set image_urls = ARRAY[image_url]
where image_url IS NOT NULL
  AND image_url != ''
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);
