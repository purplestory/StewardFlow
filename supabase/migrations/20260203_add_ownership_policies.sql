-- Add ownership_policies configuration to organizations table
-- This allows admins to configure ownership rules for spaces and vehicles per organization

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ownership_policies jsonb DEFAULT '{
  "spaces": "organization_only",
  "vehicles": "organization_only"
}'::jsonb;

-- Explanation:
-- spaces: "organization_only" (공간은 항상 기관 소유) or "department_allowed" (부서 소유 허용)
-- vehicles: "organization_only" (차량은 항상 기관 소유) or "department_allowed" (부서 소유 허용)
-- assets: 항상 "both_allowed" (물품은 부서/기관 둘 다 가능, 설정 불필요)
