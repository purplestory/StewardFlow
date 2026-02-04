-- Add menu_order column to organizations table for menu item ordering
alter table public.organizations
  add column if not exists menu_order jsonb default '[
    {"key": "equipment", "enabled": true},
    {"key": "spaces", "enabled": true},
    {"key": "vehicles", "enabled": false}
  ]'::jsonb;

-- Update existing organizations to have menu_order if they don't have it
update public.organizations
set menu_order = jsonb_build_array(
  jsonb_build_object('key', 'equipment', 'enabled', coalesce(features->>'equipment', 'true')::boolean),
  jsonb_build_object('key', 'spaces', 'enabled', coalesce(features->>'spaces', 'true')::boolean),
  jsonb_build_object('key', 'vehicles', 'enabled', coalesce(features->>'vehicles', 'false')::boolean)
)
where menu_order is null or menu_order = '[]'::jsonb;
