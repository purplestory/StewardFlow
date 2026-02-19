-- 도서 대여 관리 MVP 스키마
-- 목적:
-- 1) 기관/개인 도서 등록
-- 2) 대여 신청/승인/반납
-- 3) 2차 확장(교환/선물/기증)용 기본 테이블

-- 0) 테이블 생성
create table if not exists public.book_items (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  owner_scope text not null default 'organization', -- organization | member
  owner_profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  author text,
  publisher text,
  published_year integer,
  isbn text,
  cover_image_url text,
  category text,
  tags text[] default '{}',
  description text,
  condition text default 'good', -- new | good | fair | poor
  share_mode text not null default 'lend_only', -- lend_only | exchange_allowed | gift_allowed | donation_only
  status text not null default 'available', -- available | requested | borrowed | overdue | archived
  is_active boolean default true not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_items_owner_scope_chk check (owner_scope in ('organization', 'member')),
  constraint book_items_condition_chk check (condition in ('new', 'good', 'fair', 'poor')),
  constraint book_items_share_mode_chk check (share_mode in ('lend_only', 'exchange_allowed', 'gift_allowed', 'donation_only')),
  constraint book_items_status_chk check (status in ('available', 'requested', 'borrowed', 'overdue', 'archived')),
  constraint book_items_owner_profile_chk check (
    (owner_scope = 'organization' and owner_profile_id is null)
    or (owner_scope = 'member' and owner_profile_id is not null)
  ),
  constraint book_items_published_year_chk check (
    published_year is null or (published_year between 1000 and 2100)
  )
);

create table if not exists public.book_loans (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  book_item_id uuid references public.book_items(id) on delete cascade not null,
  borrower_id uuid references public.profiles(id) on delete cascade not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'requested', -- requested | approved | borrowed | returned | rejected | cancelled | overdue
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
  approved_at timestamp with time zone,
  borrowed_at timestamp with time zone,
  due_at timestamp with time zone,
  returned_at timestamp with time zone,
  note text,
  return_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_loans_status_chk check (status in ('requested', 'approved', 'borrowed', 'returned', 'rejected', 'cancelled', 'overdue')),
  constraint book_loans_due_after_requested_chk check (
    due_at is null or due_at > requested_at
  )
);

-- 2차 확장용: 교환/선물/기증 게시물
create table if not exists public.book_transfer_offers (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  book_item_id uuid references public.book_items(id) on delete cascade not null,
  owner_profile_id uuid references public.profiles(id) on delete cascade not null,
  offer_type text not null, -- exchange | gift | donation
  status text not null default 'open', -- open | matched | completed | cancelled
  wanted_text text,
  note text,
  matched_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  constraint book_transfer_offers_type_chk check (offer_type in ('exchange', 'gift', 'donation')),
  constraint book_transfer_offers_status_chk check (status in ('open', 'matched', 'completed', 'cancelled'))
);

-- 1) 인덱스
create index if not exists idx_book_items_org on public.book_items(organization_id);
create index if not exists idx_book_items_owner_profile on public.book_items(owner_profile_id);
create index if not exists idx_book_items_status on public.book_items(status);
create index if not exists idx_book_items_title on public.book_items(title);
create index if not exists idx_book_items_created_at on public.book_items(created_at desc);

create index if not exists idx_book_loans_org on public.book_loans(organization_id);
create index if not exists idx_book_loans_book_item on public.book_loans(book_item_id);
create index if not exists idx_book_loans_borrower on public.book_loans(borrower_id);
create index if not exists idx_book_loans_status on public.book_loans(status);
create index if not exists idx_book_loans_due_at on public.book_loans(due_at);

create index if not exists idx_book_transfer_offers_org on public.book_transfer_offers(organization_id);
create index if not exists idx_book_transfer_offers_owner on public.book_transfer_offers(owner_profile_id);
create index if not exists idx_book_transfer_offers_status on public.book_transfer_offers(status);
create index if not exists idx_book_transfer_offers_type on public.book_transfer_offers(offer_type);

-- 2) updated_at 트리거 함수
create or replace function public.set_book_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_book_items_set_updated_at on public.book_items;
create trigger trg_book_items_set_updated_at
before update on public.book_items
for each row execute function public.set_book_updated_at();

drop trigger if exists trg_book_loans_set_updated_at on public.book_loans;
create trigger trg_book_loans_set_updated_at
before update on public.book_loans
for each row execute function public.set_book_updated_at();

drop trigger if exists trg_book_transfer_offers_set_updated_at on public.book_transfer_offers;
create trigger trg_book_transfer_offers_set_updated_at
before update on public.book_transfer_offers
for each row execute function public.set_book_updated_at();

-- 3) RLS 활성화
alter table public.book_items enable row level security;
alter table public.book_loans enable row level security;
alter table public.book_transfer_offers enable row level security;

-- 4) 기존 정책 제거
drop policy if exists "book_items_select_same_org" on public.book_items;
drop policy if exists "book_items_insert_same_org" on public.book_items;
drop policy if exists "book_items_update_owner_or_manager" on public.book_items;
drop policy if exists "book_items_delete_owner_or_manager" on public.book_items;

drop policy if exists "book_loans_select_same_org" on public.book_loans;
drop policy if exists "book_loans_insert_borrower" on public.book_loans;
drop policy if exists "book_loans_update_borrower_or_owner_or_manager" on public.book_loans;

drop policy if exists "book_transfer_offers_select_same_org" on public.book_transfer_offers;
drop policy if exists "book_transfer_offers_insert_owner" on public.book_transfer_offers;
drop policy if exists "book_transfer_offers_update_owner_or_manager" on public.book_transfer_offers;

-- 5) book_items 정책
create policy "book_items_select_same_org"
on public.book_items
for select
to authenticated
using (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "book_items_insert_same_org"
on public.book_items
for insert
to authenticated
with check (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and created_by = auth.uid()
  and (
    (owner_scope = 'organization' and owner_profile_id is null)
    or (owner_scope = 'member' and owner_profile_id = auth.uid())
  )
);

create policy "book_items_update_owner_or_manager"
on public.book_items
for update
to authenticated
using (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and (
    owner_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'manager')
    )
  )
)
with check (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "book_items_delete_owner_or_manager"
on public.book_items
for delete
to authenticated
using (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and (
    owner_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'manager')
    )
  )
);

-- 6) book_loans 정책
create policy "book_loans_select_same_org"
on public.book_loans
for select
to authenticated
using (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "book_loans_insert_borrower"
on public.book_loans
for insert
to authenticated
with check (
  borrower_id = auth.uid()
  and organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and exists (
    select 1
    from public.book_items bi
    where bi.id = book_item_id
      and bi.organization_id = (
        select organization_id
        from public.profiles
        where id = auth.uid()
      )
      and bi.is_active = true
      and bi.status in ('available', 'requested')
  )
);

create policy "book_loans_update_borrower_or_owner_or_manager"
on public.book_loans
for update
to authenticated
using (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and (
    borrower_id = auth.uid()
    or owner_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'manager')
    )
  )
)
with check (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

-- 7) book_transfer_offers 정책 (2차 기능 대비)
create policy "book_transfer_offers_select_same_org"
on public.book_transfer_offers
for select
to authenticated
using (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "book_transfer_offers_insert_owner"
on public.book_transfer_offers
for insert
to authenticated
with check (
  owner_profile_id = auth.uid()
  and organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "book_transfer_offers_update_owner_or_manager"
on public.book_transfer_offers
for update
to authenticated
using (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and (
    owner_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'manager')
    )
  )
)
with check (
  organization_id = (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);
