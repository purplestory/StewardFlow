-- Add managed_by_department field to spaces and assets tables
-- This field represents the department that regularly uses and manages the asset/space
-- even though it's owned by the organization

-- Add managed_by_department to spaces table
ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS managed_by_department text;

-- Add managed_by_department to assets table
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS managed_by_department text;

-- Update default owner_scope for spaces to 'organization' (spaces are typically organization-owned)
-- Note: This only affects new records, existing records keep their current value
ALTER TABLE public.spaces
ALTER COLUMN owner_scope SET DEFAULT 'organization';

-- For spaces, when owner_scope is 'organization', owner_department should be '기관 공용' or similar
-- We'll keep the NOT NULL constraint but allow it to be set to a default value
-- Existing spaces with department ownership will need to be manually updated if needed
