-- Create departments table for organization structure
create table if not exists public.departments (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(organization_id, name)
);

-- Create index for faster lookups
create index if not exists idx_departments_organization_id
  on public.departments(organization_id);

-- Enable RLS
alter table public.departments enable row level security;

-- RLS Policies for departments
-- Users can view departments in their organization
create policy "departments_select_own_org"
  on public.departments
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id 
      from public.profiles 
      where id = auth.uid()
    )
  );

-- Only admins and managers can insert departments
create policy "departments_insert_managers"
  on public.departments
  for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id 
      from public.profiles 
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );

-- Only admins and managers can update departments
create policy "departments_update_managers"
  on public.departments
  for update
  to authenticated
  using (
    organization_id in (
      select organization_id 
      from public.profiles 
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );

-- Only admins can delete departments
create policy "departments_delete_admins"
  on public.departments
  for delete
  to authenticated
  using (
    organization_id in (
      select organization_id 
      from public.profiles 
      where id = auth.uid()
        and role = 'admin'
    )
  );
