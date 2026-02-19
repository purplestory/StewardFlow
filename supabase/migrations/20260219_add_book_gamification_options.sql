-- 도서 게임화 확장 (듀오링고식 경쟁/응원 + 선택형 시상)
-- 전제:
-- - 20260219_create_book_lending_mvp.sql
-- - 20260219_extend_book_lending_self_service.sql

-- 0) 기관별 게임화/시상 설정
create table if not exists public.book_program_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  gamification_enabled boolean not null default true,
  leaderboard_enabled boolean not null default true,
  cheer_enabled boolean not null default true,
  streak_enabled boolean not null default true,
  rewards_enabled boolean not null default false,
  reward_mode text not null default 'manual', -- manual | auto
  monthly_reset_day smallint not null default 1,
  daily_point_cap integer not null default 120,
  late_return_penalty integer not null default -8,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_program_settings_reward_mode_chk check (reward_mode in ('manual', 'auto')),
  constraint book_program_settings_reset_day_chk check (monthly_reset_day between 1 and 28),
  constraint book_program_settings_daily_cap_chk check (daily_point_cap >= 0)
);

drop trigger if exists trg_book_program_settings_set_updated_at on public.book_program_settings;
create trigger trg_book_program_settings_set_updated_at
before update on public.book_program_settings
for each row execute function public.set_book_updated_at();

-- 1) 포인트 적립 규칙 (기관 커스터마이즈)
create table if not exists public.book_scoring_rules (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  rule_key text not null, -- book_complete | on_time_return | note_write | quiz_complete | streak_bonus | cheer_received | overdue_penalty
  label text not null,
  enabled boolean not null default true,
  point_value integer not null,
  unit text not null default 'per_event', -- per_event | per_day | per_book
  daily_limit integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_scoring_rules_unit_chk check (unit in ('per_event', 'per_day', 'per_book')),
  constraint book_scoring_rules_daily_limit_chk check (daily_limit is null or daily_limit >= 0),
  constraint book_scoring_rules_unique unique (organization_id, rule_key)
);

create index if not exists idx_book_scoring_rules_org
on public.book_scoring_rules(organization_id);

drop trigger if exists trg_book_scoring_rules_set_updated_at on public.book_scoring_rules;
create trigger trg_book_scoring_rules_set_updated_at
before update on public.book_scoring_rules
for each row execute function public.set_book_updated_at();

-- 2) 사용자 독서 진행도/스트릭
create table if not exists public.book_user_progress (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  current_streak_days integer not null default 0,
  longest_streak_days integer not null default 0,
  last_activity_date date,
  total_books_completed integer not null default 0,
  total_notes_written integer not null default 0,
  total_quizzes_completed integer not null default 0,
  monthly_books_completed integer not null default 0,
  monthly_points integer not null default 0,
  lifetime_points integer not null default 0,
  cheers_received integer not null default 0,
  cheers_sent integer not null default 0,
  rank_tier text not null default 'seed', -- seed | bronze | silver | gold | diamond
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_user_progress_unique unique (organization_id, profile_id),
  constraint book_user_progress_rank_tier_chk check (rank_tier in ('seed', 'bronze', 'silver', 'gold', 'diamond'))
);

create index if not exists idx_book_user_progress_org_points
on public.book_user_progress(organization_id, monthly_points desc, lifetime_points desc);

create index if not exists idx_book_user_progress_org_streak
on public.book_user_progress(organization_id, current_streak_days desc);

drop trigger if exists trg_book_user_progress_set_updated_at on public.book_user_progress;
create trigger trg_book_user_progress_set_updated_at
before update on public.book_user_progress
for each row execute function public.set_book_updated_at();

-- 3) 응원 기능
create table if not exists public.book_cheers (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  from_profile_id uuid references public.profiles(id) on delete cascade not null,
  to_profile_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null default 'progress', -- progress | note | quiz | ranking
  target_id uuid,
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_date date default (timezone('utc'::text, now()))::date not null,
  constraint book_cheers_target_type_chk check (target_type in ('progress', 'note', 'quiz', 'ranking')),
  constraint book_cheers_self_chk check (from_profile_id <> to_profile_id)
);

create index if not exists idx_book_cheers_org_created_at
on public.book_cheers(organization_id, created_at desc);

create index if not exists idx_book_cheers_to_profile
on public.book_cheers(organization_id, to_profile_id, created_at desc);

create unique index if not exists idx_book_cheers_daily_unique
on public.book_cheers (
  organization_id,
  from_profile_id,
  to_profile_id,
  target_type,
  coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid),
  created_date
);

-- 4) 리더보드 스냅샷
create table if not exists public.book_leaderboard_snapshots (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  period_type text not null, -- weekly | monthly | quarterly | yearly
  period_key text not null,  -- ex) 2026-W08, 2026-02, 2026-Q1, 2026
  profile_id uuid references public.profiles(id) on delete cascade not null,
  rank_no integer not null,
  total_points integer not null default 0,
  books_completed integer not null default 0,
  streak_days integer not null default 0,
  cheers_received integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_leaderboard_period_type_chk check (period_type in ('weekly', 'monthly', 'quarterly', 'yearly')),
  constraint book_leaderboard_rank_no_chk check (rank_no > 0),
  constraint book_leaderboard_unique unique (organization_id, period_type, period_key, profile_id)
);

create index if not exists idx_book_leaderboard_snapshots_period
on public.book_leaderboard_snapshots(organization_id, period_type, period_key, rank_no);

-- 5) 포인트 원장 확장
alter table public.book_point_ledger
  add column if not exists rule_key text,
  add column if not exists source_date date default (timezone('utc'::text, now()))::date,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.book_point_ledger
  drop constraint if exists book_point_ledger_source_type_chk;

alter table public.book_point_ledger
  add constraint book_point_ledger_source_type_chk
  check (
    source_type in (
      'loan',
      'return',
      'note',
      'quiz',
      'bonus',
      'penalty',
      'completion',
      'streak',
      'cheer',
      'mission'
    )
  );

create index if not exists idx_book_point_ledger_org_source_date
on public.book_point_ledger(organization_id, profile_id, source_date desc);

-- 5-1) 기존 기관 기본값 시드
insert into public.book_program_settings (organization_id)
select o.id
from public.organizations o
on conflict (organization_id) do nothing;

insert into public.book_scoring_rules (
  organization_id,
  rule_key,
  label,
  enabled,
  point_value,
  unit
)
select
  o.id,
  rules.rule_key,
  rules.label,
  rules.enabled,
  rules.point_value,
  rules.unit
from public.organizations o
cross join (
  values
    ('book_complete', '완독/반납 완료', true, 10, 'per_book'),
    ('on_time_return', '정시 반납 보너스', true, 5, 'per_book'),
    ('note_write', '독서 메모 작성', true, 8, 'per_event'),
    ('quiz_complete', '퀴즈 완료', true, 7, 'per_event'),
    ('streak_bonus', '연속 독서 보너스', true, 10, 'per_day'),
    ('cheer_received', '응원 받음', true, 2, 'per_event'),
    ('overdue_penalty', '연체 패널티', true, -8, 'per_event')
) as rules(rule_key, label, enabled, point_value, unit)
on conflict (organization_id, rule_key) do nothing;

-- 6) RLS 활성화
alter table public.book_program_settings enable row level security;
alter table public.book_scoring_rules enable row level security;
alter table public.book_user_progress enable row level security;
alter table public.book_cheers enable row level security;
alter table public.book_leaderboard_snapshots enable row level security;

-- 7) 기존 정책 삭제
drop policy if exists "book_program_settings_select_same_org" on public.book_program_settings;
drop policy if exists "book_program_settings_insert_manager" on public.book_program_settings;
drop policy if exists "book_program_settings_update_manager" on public.book_program_settings;

drop policy if exists "book_scoring_rules_select_same_org" on public.book_scoring_rules;
drop policy if exists "book_scoring_rules_insert_manager" on public.book_scoring_rules;
drop policy if exists "book_scoring_rules_update_manager" on public.book_scoring_rules;

drop policy if exists "book_user_progress_select_same_org" on public.book_user_progress;
drop policy if exists "book_user_progress_insert_manager" on public.book_user_progress;
drop policy if exists "book_user_progress_update_manager_or_owner" on public.book_user_progress;
drop policy if exists "book_user_progress_update_manager" on public.book_user_progress;

drop policy if exists "book_cheers_select_same_org" on public.book_cheers;
drop policy if exists "book_cheers_insert_self" on public.book_cheers;
drop policy if exists "book_cheers_delete_sender_or_manager" on public.book_cheers;

drop policy if exists "book_leaderboard_snapshots_select_same_org" on public.book_leaderboard_snapshots;
drop policy if exists "book_leaderboard_snapshots_insert_manager" on public.book_leaderboard_snapshots;

-- 8) 조회 정책
create policy "book_program_settings_select_same_org"
on public.book_program_settings
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_scoring_rules_select_same_org"
on public.book_scoring_rules
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_user_progress_select_same_org"
on public.book_user_progress
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_cheers_select_same_org"
on public.book_cheers
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_leaderboard_snapshots_select_same_org"
on public.book_leaderboard_snapshots
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

-- 9) 입력/수정 정책
create policy "book_program_settings_insert_manager"
on public.book_program_settings
for insert
to authenticated
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

create policy "book_program_settings_update_manager"
on public.book_program_settings
for update
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
)
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_scoring_rules_insert_manager"
on public.book_scoring_rules
for insert
to authenticated
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

create policy "book_scoring_rules_update_manager"
on public.book_scoring_rules
for update
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
)
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_user_progress_insert_manager"
on public.book_user_progress
for insert
to authenticated
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

create policy "book_user_progress_update_manager"
on public.book_user_progress
for update
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
)
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_cheers_insert_self"
on public.book_cheers
for insert
to authenticated
with check (
  from_profile_id = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
  and coalesce(
    (
      select s.cheer_enabled
      from public.book_program_settings s
      where s.organization_id = (select organization_id from public.profiles where id = auth.uid())
    ),
    true
  )
);

create policy "book_cheers_delete_sender_or_manager"
on public.book_cheers
for delete
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    from_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager')
    )
  )
);

create policy "book_leaderboard_snapshots_insert_manager"
on public.book_leaderboard_snapshots
for insert
to authenticated
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);
