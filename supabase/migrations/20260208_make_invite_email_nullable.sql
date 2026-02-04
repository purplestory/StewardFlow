-- Make email column nullable in organization_invites table
-- Email is optional for invitations (users can join with invite code only)
ALTER TABLE public.organization_invites 
ALTER COLUMN email DROP NOT NULL;
