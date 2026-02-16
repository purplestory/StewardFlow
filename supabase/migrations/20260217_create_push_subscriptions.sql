-- Web Push 구독 저장 테이블 생성
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id),
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text,
  auth text,
  user_agent text,
  last_seen_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions(user_id);

create index if not exists idx_push_subscriptions_org_id
  on public.push_subscriptions(organization_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
  and organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
);

