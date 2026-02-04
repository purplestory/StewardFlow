-- Add deletion_reason column to assets, spaces, and vehicles
-- This allows tracking why resources were deleted

-- Add deletion_reason to assets
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'assets' 
    AND column_name = 'deletion_reason'
  ) THEN
    ALTER TABLE public.assets 
    ADD COLUMN deletion_reason text;
  END IF;
END $$;

-- Add deletion_reason to spaces
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'spaces' 
    AND column_name = 'deletion_reason'
  ) THEN
    ALTER TABLE public.spaces 
    ADD COLUMN deletion_reason text;
  END IF;
END $$;

-- Add deletion_reason to vehicles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vehicles' 
    AND column_name = 'deletion_reason'
  ) THEN
    ALTER TABLE public.vehicles 
    ADD COLUMN deletion_reason text;
  END IF;
END $$;
