-- Add insert policy for profiles table
-- Users should be able to create their own profile

create policy if not exists "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());
