-- Add asset_categories field to organizations table
-- This allows each organization to manage their own asset categories

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'asset_categories'
  ) THEN
    ALTER TABLE public.organizations 
    ADD COLUMN asset_categories jsonb default '[
      {"value": "sound", "label": "음향"},
      {"value": "video", "label": "영상"},
      {"value": "kitchen", "label": "조리"},
      {"value": "furniture", "label": "가구"},
      {"value": "etc", "label": "기타"}
    ]'::jsonb;
  END IF;
END $$;
