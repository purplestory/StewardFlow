-- Add token field to organization_invites for invite links
alter table public.organization_invites
  add column if not exists token text unique;

-- Create index for faster token lookups
create index if not exists idx_organization_invites_token
  on public.organization_invites(token)
  where token is not null and accepted_at is null and revoked_at is null;
