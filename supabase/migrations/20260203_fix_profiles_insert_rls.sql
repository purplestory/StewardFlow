-- Fix profiles insert RLS policy
-- Ensure users can create their own profile

-- Check if RLS is enabled
alter table public.profiles enable row level security;

-- Drop existing insert policy
drop policy if exists "profiles_insert_own" on public.profiles;

-- Create insert policy - users can create their own profile
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

-- Verify the policy
SELECT 
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND cmd = 'INSERT';
