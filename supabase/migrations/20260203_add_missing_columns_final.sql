-- Add missing columns to organizations table
-- This migration adds all the columns that are used by FeatureSettings but missing from the database

-- Add features column if not exists
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{
  "equipment": true,
  "spaces": true,
  "vehicles": false
}'::jsonb;

-- Add menu_labels column if not exists
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS menu_labels jsonb DEFAULT '{
  "equipment": "물품",
  "spaces": "공간",
  "vehicles": "차량"
}'::jsonb;

-- Add menu_order column if not exists
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS menu_order jsonb DEFAULT '[
  {"key": "equipment", "enabled": true},
  {"key": "spaces", "enabled": true},
  {"key": "vehicles", "enabled": false}
]'::jsonb;

-- Add ownership_policies column if not exists
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ownership_policies jsonb DEFAULT '{
  "spaces": "organization_only",
  "vehicles": "organization_only"
}'::jsonb;

-- Add categories column if not exists
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[
  {"key": "items", "label": "물품", "enabled": true},
  {"key": "spaces", "label": "공간", "enabled": true},
  {"key": "vehicles", "label": "차량", "enabled": false}
]'::jsonb;

-- Update existing organizations to have menu_order if they don't have it
UPDATE public.organizations
SET menu_order = jsonb_build_array(
  jsonb_build_object('key', 'equipment', 'enabled', coalesce((features->>'equipment')::boolean, true)),
  jsonb_build_object('key', 'spaces', 'enabled', coalesce((features->>'spaces')::boolean, true)),
  jsonb_build_object('key', 'vehicles', 'enabled', coalesce((features->>'vehicles')::boolean, false))
)
WHERE menu_order IS NULL OR menu_order = '[]'::jsonb;

-- Add managed_by_department to assets table if not exists
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS managed_by_department text;

-- Add managed_by_department to spaces table if not exists
ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS managed_by_department text;

-- Update default owner_scope for spaces to 'organization'
ALTER TABLE public.spaces
ALTER COLUMN owner_scope SET DEFAULT 'organization';

-- Add token column to organization_invites if not exists
ALTER TABLE public.organization_invites
ADD COLUMN IF NOT EXISTS token text;

-- Create unique index on token if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_invites_token
ON public.organization_invites(token)
WHERE token IS NOT NULL AND accepted_at IS NULL AND revoked_at IS NULL;
