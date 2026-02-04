-- Add name and department fields to organization_invites table
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_invites') THEN
    -- Add name column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'name') THEN
      ALTER TABLE public.organization_invites
      ADD COLUMN name text;
    END IF;
    
    -- Add department column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invites' AND column_name = 'department') THEN
      ALTER TABLE public.organization_invites
      ADD COLUMN department text;
    END IF;
  END IF;
END $$;
