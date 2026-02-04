-- Add model_name column to assets table
-- This allows storing the model name separately from the product name

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'assets' 
    AND column_name = 'model_name'
  ) THEN
    ALTER TABLE public.assets 
    ADD COLUMN model_name text;
  END IF;
END $$;
