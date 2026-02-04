-- Add short_id column to assets table
-- This allows using shorter, more user-friendly IDs in URLs instead of full UUIDs

ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS short_id text;

-- Create unique index on short_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_short_id 
ON public.assets(short_id) 
WHERE short_id IS NOT NULL;

-- Create index on organization_id and short_id for organization-scoped lookups
CREATE INDEX IF NOT EXISTS idx_assets_org_short_id 
ON public.assets(organization_id, short_id) 
WHERE short_id IS NOT NULL;

-- Add short_id to spaces table as well
ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS short_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_short_id 
ON public.spaces(short_id) 
WHERE short_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spaces_org_short_id 
ON public.spaces(organization_id, short_id) 
WHERE short_id IS NOT NULL;
