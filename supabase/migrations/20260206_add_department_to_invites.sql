-- Add department field to organization_invites table
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_invites') THEN
    ALTER TABLE public.organization_invites
    ADD COLUMN IF NOT EXISTS department text;
  END IF;
END $$;
