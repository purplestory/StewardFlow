-- Add features configuration to organizations table
-- This allows admins to enable/disable features per organization

-- Step 1: Add features column to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{
  "equipment": true,
  "spaces": true,
  "vehicles": false
}'::jsonb;

-- Step 2: Add menu_labels column for custom menu names
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS menu_labels jsonb DEFAULT '{
  "equipment": "물품",
  "spaces": "공간",
  "vehicles": "차량"
}'::jsonb;

-- Step 3: Verify the columns were added
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND column_name IN ('features', 'menu_labels')
ORDER BY column_name;
