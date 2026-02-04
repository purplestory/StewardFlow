-- Add categories field to organizations for custom category management
alter table public.organizations
  add column if not exists categories jsonb default '[
    {"key": "items", "label": "물품", "enabled": true},
    {"key": "spaces", "label": "공간", "enabled": true},
    {"key": "vehicles", "label": "차량", "enabled": false}
  ]'::jsonb;

-- Update existing organizations to use new category structure
-- Convert old features/menu_labels to new categories format
update public.organizations
set categories = jsonb_build_array(
  jsonb_build_object(
    'key', 'items',
    'label', coalesce(menu_labels->>'equipment', '물품'),
    'enabled', coalesce((features->>'equipment')::boolean, true)
  ),
  jsonb_build_object(
    'key', 'spaces',
    'label', coalesce(menu_labels->>'spaces', '공간'),
    'enabled', coalesce((features->>'spaces')::boolean, true)
  ),
  jsonb_build_object(
    'key', 'vehicles',
    'label', coalesce(menu_labels->>'vehicles', '차량'),
    'enabled', coalesce((features->>'vehicles')::boolean, false)
  )
)
where categories is null or categories = '[]'::jsonb;
