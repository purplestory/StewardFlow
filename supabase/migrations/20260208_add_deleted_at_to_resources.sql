-- Add deleted_at column to assets, spaces, and vehicles for soft delete
-- Only admins can permanently delete (hard delete) resources

-- Add deleted_at to assets
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'assets' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.assets 
    ADD COLUMN deleted_at timestamp with time zone;
  END IF;
END $$;

-- Add deleted_at to spaces
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'spaces' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.spaces 
    ADD COLUMN deleted_at timestamp with time zone;
  END IF;
END $$;

-- Add deleted_at to vehicles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vehicles' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.vehicles 
    ADD COLUMN deleted_at timestamp with time zone;
  END IF;
END $$;

-- Create index for faster queries of non-deleted resources
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON public.assets(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spaces_deleted_at ON public.spaces(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles(deleted_at) WHERE deleted_at IS NULL;
