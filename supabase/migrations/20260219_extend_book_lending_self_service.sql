-- 도서 대여 확장 스키마
-- 범위:
-- 1) 자율 대출/반납(스캔 + 서가코드 + 반납사진)
-- 2) 메모/서평
-- 3) AI 퀴즈
-- 4) 포인트/시상

-- 0) 기존 테이블 확장
alter table public.book_items
  add column if not exists copy_code text,
  add column if not exists shelf_code text,
  add column if not exists shelf_label text,
  add column if not exists self_checkout_enabled boolean not null default true;

create unique index if not exists idx_book_items_org_copy_code_unique
on public.book_items(organization_id, copy_code)
where copy_code is not null;

create index if not exists idx_book_items_org_shelf_code
on public.book_items(organization_id, shelf_code);

alter table public.book_loans
  add column if not exists checkout_method text not null default 'staff',
  add column if not exists checkout_scan_code text,
  add column if not exists checkout_scanned_at timestamp with time zone,
  add column if not exists return_method text,
  add column if not exists return_shelf_code text,
  add column if not exists return_photo_url text,
  add column if not exists return_verification_status text not null default 'not_required',
  add column if not exists return_verification_note text,
  add column if not exists return_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists return_verified_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'book_loans_checkout_method_chk'
      and conrelid = 'public.book_loans'::regclass
  ) then
    alter table public.book_loans
      add constraint book_loans_checkout_method_chk
      check (checkout_method in ('staff', 'self_scan'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'book_loans_return_method_chk'
      and conrelid = 'public.book_loans'::regclass
  ) then
    alter table public.book_loans
      add constraint book_loans_return_method_chk
      check (return_method is null or return_method in ('staff', 'self_photo'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'book_loans_return_verify_status_chk'
      and conrelid = 'public.book_loans'::regclass
  ) then
    alter table public.book_loans
      add constraint book_loans_return_verify_status_chk
      check (return_verification_status in ('not_required', 'pending', 'verified', 'rejected'));
  end if;
end $$;

create index if not exists idx_book_loans_org_checkout_method
on public.book_loans(organization_id, checkout_method);

create index if not exists idx_book_loans_org_return_verify_status
on public.book_loans(organization_id, return_verification_status);

-- 1) 자율 반납 증빙
create table if not exists public.book_return_evidences (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  loan_id uuid references public.book_loans(id) on delete cascade not null,
  book_item_id uuid references public.book_items(id) on delete cascade not null,
  returned_by uuid references public.profiles(id) on delete set null,
  shelf_code text,
  shelf_label text,
  photo_url text,
  photo_urls text[] default '{}',
  verify_status text not null default 'pending', -- pending | verified | rejected
  verify_note text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_return_evidences_status_chk check (verify_status in ('pending', 'verified', 'rejected'))
);

create index if not exists idx_book_return_evidences_org
on public.book_return_evidences(organization_id);

create index if not exists idx_book_return_evidences_loan
on public.book_return_evidences(loan_id);

create index if not exists idx_book_return_evidences_status
on public.book_return_evidences(verify_status);

drop trigger if exists trg_book_return_evidences_set_updated_at on public.book_return_evidences;
create trigger trg_book_return_evidences_set_updated_at
before update on public.book_return_evidences
for each row execute function public.set_book_updated_at();

-- 2) 메모/서평/독후감
create table if not exists public.book_notes (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  book_item_id uuid references public.book_items(id) on delete cascade not null,
  loan_id uuid references public.book_loans(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  note_type text not null default 'memo', -- memo | review | reflection
  visibility text not null default 'organization', -- private | organization
  rating smallint,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone,
  constraint book_notes_type_chk check (note_type in ('memo', 'review', 'reflection')),
  constraint book_notes_visibility_chk check (visibility in ('private', 'organization')),
  constraint book_notes_rating_chk check (rating is null or rating between 1 and 5)
);

create index if not exists idx_book_notes_org
on public.book_notes(organization_id);

create index if not exists idx_book_notes_book_item
on public.book_notes(book_item_id);

create index if not exists idx_book_notes_author
on public.book_notes(author_id);

create index if not exists idx_book_notes_created_at
on public.book_notes(created_at desc);

drop trigger if exists trg_book_notes_set_updated_at on public.book_notes;
create trigger trg_book_notes_set_updated_at
before update on public.book_notes
for each row execute function public.set_book_updated_at();

-- 3) AI 퀴즈
create table if not exists public.book_quiz_sessions (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  book_item_id uuid references public.book_items(id) on delete cascade not null,
  loan_id uuid references public.book_loans(id) on delete set null,
  participant_id uuid references public.profiles(id) on delete set null,
  level text not null default 'beginner', -- beginner | intermediate | advanced
  source_type text not null default 'hybrid', -- book_meta | user_note | hybrid
  status text not null default 'generated', -- generated | in_progress | completed | cancelled
  question_count integer not null default 0,
  correct_count integer not null default 0,
  score integer not null default 0,
  model_name text,
  prompt_version text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_quiz_sessions_level_chk check (level in ('beginner', 'intermediate', 'advanced')),
  constraint book_quiz_sessions_source_chk check (source_type in ('book_meta', 'user_note', 'hybrid')),
  constraint book_quiz_sessions_status_chk check (status in ('generated', 'in_progress', 'completed', 'cancelled'))
);

create index if not exists idx_book_quiz_sessions_org
on public.book_quiz_sessions(organization_id);

create index if not exists idx_book_quiz_sessions_participant
on public.book_quiz_sessions(participant_id);

create index if not exists idx_book_quiz_sessions_book_item
on public.book_quiz_sessions(book_item_id);

create index if not exists idx_book_quiz_sessions_status
on public.book_quiz_sessions(status);

drop trigger if exists trg_book_quiz_sessions_set_updated_at on public.book_quiz_sessions;
create trigger trg_book_quiz_sessions_set_updated_at
before update on public.book_quiz_sessions
for each row execute function public.set_book_updated_at();

create table if not exists public.book_quiz_questions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.book_quiz_sessions(id) on delete cascade not null,
  sequence integer not null,
  question_type text not null default 'mcq', -- mcq | short_answer | true_false
  prompt text not null,
  choices jsonb not null default '[]'::jsonb,
  answer_key text,
  explanation text,
  difficulty smallint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_quiz_questions_type_chk check (question_type in ('mcq', 'short_answer', 'true_false')),
  constraint book_quiz_questions_difficulty_chk check (difficulty is null or difficulty between 1 and 5),
  constraint book_quiz_questions_sequence_unique unique (session_id, sequence)
);

create index if not exists idx_book_quiz_questions_session
on public.book_quiz_questions(session_id);

create table if not exists public.book_quiz_attempts (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  session_id uuid references public.book_quiz_sessions(id) on delete cascade not null,
  question_id uuid references public.book_quiz_questions(id) on delete cascade not null,
  participant_id uuid references public.profiles(id) on delete set null,
  answer_text text,
  is_correct boolean,
  score_delta integer not null default 0,
  answered_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists idx_book_quiz_attempts_once_per_question
on public.book_quiz_attempts(session_id, question_id, participant_id);

create index if not exists idx_book_quiz_attempts_org_participant
on public.book_quiz_attempts(organization_id, participant_id);

-- 4) 포인트/시상
create table if not exists public.book_point_ledger (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  source_type text not null, -- loan | return | note | quiz | bonus | penalty
  source_id uuid,
  points integer not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_point_ledger_source_type_chk check (source_type in ('loan', 'return', 'note', 'quiz', 'bonus', 'penalty'))
);

create index if not exists idx_book_point_ledger_org_profile
on public.book_point_ledger(organization_id, profile_id);

create index if not exists idx_book_point_ledger_created_at
on public.book_point_ledger(created_at desc);

create table if not exists public.book_reward_events (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  period_type text not null, -- monthly | quarterly | yearly
  period_key text not null,  -- ex) 2026-02, 2026-Q1, 2026
  status text not null default 'pending', -- pending | calculated | announced | closed
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_reward_events_period_type_chk check (period_type in ('monthly', 'quarterly', 'yearly')),
  constraint book_reward_events_status_chk check (status in ('pending', 'calculated', 'announced', 'closed')),
  constraint book_reward_events_period_unique unique (organization_id, period_type, period_key)
);

create index if not exists idx_book_reward_events_org_status
on public.book_reward_events(organization_id, status);

drop trigger if exists trg_book_reward_events_set_updated_at on public.book_reward_events;
create trigger trg_book_reward_events_set_updated_at
before update on public.book_reward_events
for each row execute function public.set_book_updated_at();

create table if not exists public.book_reward_rankings (
  id uuid default gen_random_uuid() primary key,
  reward_event_id uuid references public.book_reward_events(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  total_points integer not null default 0,
  quiz_points integer not null default 0,
  note_points integer not null default 0,
  activity_points integer not null default 0,
  rank_no integer,
  prize_label text,
  awarded_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_reward_rankings_unique unique (reward_event_id, profile_id)
);

create index if not exists idx_book_reward_rankings_event
on public.book_reward_rankings(reward_event_id);

create index if not exists idx_book_reward_rankings_org_profile
on public.book_reward_rankings(organization_id, profile_id);

-- 5) 스캔 이벤트 로그
create table if not exists public.book_scan_events (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete set null,
  loan_id uuid references public.book_loans(id) on delete set null,
  book_item_id uuid references public.book_items(id) on delete set null,
  event_type text not null, -- checkout_scan | return_scan | shelf_scan
  scanned_code text not null,
  result text not null, -- success | failed
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint book_scan_events_type_chk check (event_type in ('checkout_scan', 'return_scan', 'shelf_scan')),
  constraint book_scan_events_result_chk check (result in ('success', 'failed'))
);

create index if not exists idx_book_scan_events_org_created_at
on public.book_scan_events(organization_id, created_at desc);

create index if not exists idx_book_scan_events_actor
on public.book_scan_events(actor_id);

-- 6) RLS 활성화
alter table public.book_return_evidences enable row level security;
alter table public.book_notes enable row level security;
alter table public.book_quiz_sessions enable row level security;
alter table public.book_quiz_questions enable row level security;
alter table public.book_quiz_attempts enable row level security;
alter table public.book_point_ledger enable row level security;
alter table public.book_reward_events enable row level security;
alter table public.book_reward_rankings enable row level security;
alter table public.book_scan_events enable row level security;

-- 7) 정책 초기화
drop policy if exists "book_return_evidences_select_same_org" on public.book_return_evidences;
drop policy if exists "book_return_evidences_insert_self" on public.book_return_evidences;
drop policy if exists "book_return_evidences_update_manager" on public.book_return_evidences;

drop policy if exists "book_notes_select_same_org_or_private_owner" on public.book_notes;
drop policy if exists "book_notes_insert_author" on public.book_notes;
drop policy if exists "book_notes_update_author_or_manager" on public.book_notes;
drop policy if exists "book_notes_delete_author_or_manager" on public.book_notes;

drop policy if exists "book_quiz_sessions_select_same_org" on public.book_quiz_sessions;
drop policy if exists "book_quiz_sessions_insert_participant_or_manager" on public.book_quiz_sessions;
drop policy if exists "book_quiz_sessions_update_participant_or_manager" on public.book_quiz_sessions;

drop policy if exists "book_quiz_questions_select_same_org" on public.book_quiz_questions;
drop policy if exists "book_quiz_questions_insert_owner_or_manager" on public.book_quiz_questions;
drop policy if exists "book_quiz_questions_update_manager" on public.book_quiz_questions;

drop policy if exists "book_quiz_attempts_select_same_org" on public.book_quiz_attempts;
drop policy if exists "book_quiz_attempts_insert_participant" on public.book_quiz_attempts;

drop policy if exists "book_point_ledger_select_same_org" on public.book_point_ledger;
drop policy if exists "book_point_ledger_insert_manager" on public.book_point_ledger;

drop policy if exists "book_reward_events_select_same_org" on public.book_reward_events;
drop policy if exists "book_reward_events_insert_manager" on public.book_reward_events;
drop policy if exists "book_reward_events_update_manager" on public.book_reward_events;

drop policy if exists "book_reward_rankings_select_same_org" on public.book_reward_rankings;
drop policy if exists "book_reward_rankings_insert_manager" on public.book_reward_rankings;
drop policy if exists "book_reward_rankings_update_manager" on public.book_reward_rankings;

drop policy if exists "book_scan_events_select_same_org" on public.book_scan_events;
drop policy if exists "book_scan_events_insert_self" on public.book_scan_events;

-- 8) 공통 셀렉트 정책
create policy "book_return_evidences_select_same_org"
on public.book_return_evidences
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_notes_select_same_org_or_private_owner"
on public.book_notes
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (visibility = 'organization' or author_id = auth.uid())
);

create policy "book_quiz_sessions_select_same_org"
on public.book_quiz_sessions
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_quiz_questions_select_same_org"
on public.book_quiz_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.book_quiz_sessions s
    where s.id = session_id
      and s.organization_id = (select organization_id from public.profiles where id = auth.uid())
  )
);

create policy "book_quiz_attempts_select_same_org"
on public.book_quiz_attempts
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_point_ledger_select_same_org"
on public.book_point_ledger
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_reward_events_select_same_org"
on public.book_reward_events
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_reward_rankings_select_same_org"
on public.book_reward_rankings
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_scan_events_select_same_org"
on public.book_scan_events
for select
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

-- 9) 입력/수정 정책
create policy "book_return_evidences_insert_self"
on public.book_return_evidences
for insert
to authenticated
with check (
  returned_by = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_return_evidences_update_manager"
on public.book_return_evidences
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

create policy "book_notes_insert_author"
on public.book_notes
for insert
to authenticated
with check (
  author_id = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_notes_update_author_or_manager"
on public.book_notes
for update
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    author_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager')
    )
  )
)
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_notes_delete_author_or_manager"
on public.book_notes
for delete
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    author_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager')
    )
  )
);

create policy "book_quiz_sessions_insert_participant_or_manager"
on public.book_quiz_sessions
for insert
to authenticated
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    participant_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager')
    )
  )
);

create policy "book_quiz_sessions_update_participant_or_manager"
on public.book_quiz_sessions
for update
to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    participant_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager')
    )
  )
)
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "book_quiz_questions_insert_owner_or_manager"
on public.book_quiz_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.book_quiz_sessions s
    where s.id = session_id
      and s.organization_id = (select organization_id from public.profiles where id = auth.uid())
      and (
        s.participant_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'manager')
        )
      )
  )
);

create policy "book_quiz_questions_update_manager"
on public.book_quiz_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.book_quiz_sessions s
    where s.id = session_id
      and s.organization_id = (select organization_id from public.profiles where id = auth.uid())
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'manager')
      )
  )
)
with check (
  exists (
    select 1
    from public.book_quiz_sessions s
    where s.id = session_id
      and s.organization_id = (select organization_id from public.profiles where id = auth.uid())
  )
);

create policy "book_quiz_attempts_insert_participant"
on public.book_quiz_attempts
for insert
to authenticated
with check (
  participant_id = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
  and exists (
    select 1
    from public.book_quiz_sessions s
    where s.id = session_id
      and s.participant_id = auth.uid()
      and s.organization_id = (select organization_id from public.profiles where id = auth.uid())
  )
);

create policy "book_point_ledger_insert_manager"
on public.book_point_ledger
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

create policy "book_reward_events_insert_manager"
on public.book_reward_events
for insert
to authenticated
with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

create policy "book_reward_events_update_manager"
on public.book_reward_events
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

create policy "book_reward_rankings_insert_manager"
on public.book_reward_rankings
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

create policy "book_reward_rankings_update_manager"
on public.book_reward_rankings
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

create policy "book_scan_events_insert_self"
on public.book_scan_events
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
);
