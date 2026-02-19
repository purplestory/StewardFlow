-- organizations.features/menu_labels/menu_order에 books 메뉴를 추가
-- 목표:
-- 1) 통합 플랫폼 내 도서 UI를 별도 제품처럼 운영
-- 2) 기관별로 books 기능을 ON/OFF 가능

alter table public.organizations
  alter column features set default '{
    "equipment": true,
    "spaces": true,
    "vehicles": false,
    "books": false
  }'::jsonb;

alter table public.organizations
  alter column menu_labels set default '{
    "equipment": "물품",
    "spaces": "공간",
    "vehicles": "차량",
    "books": "도서"
  }'::jsonb;

alter table public.organizations
  alter column menu_order set default '[
    {"key": "equipment", "enabled": true},
    {"key": "spaces", "enabled": true},
    {"key": "vehicles", "enabled": false},
    {"key": "books", "enabled": false}
  ]'::jsonb;

update public.organizations
set features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
  'books',
  coalesce((features->>'books')::boolean, false)
)
where features is null or not (features ? 'books');

update public.organizations
set menu_labels = coalesce(menu_labels, '{}'::jsonb) || jsonb_build_object(
  'books',
  coalesce(menu_labels->>'books', '도서')
)
where menu_labels is null or not (menu_labels ? 'books');

update public.organizations
set menu_order = jsonb_build_array(
  jsonb_build_object(
    'key', 'equipment',
    'enabled', coalesce((features->>'equipment')::boolean, true)
  ),
  jsonb_build_object(
    'key', 'spaces',
    'enabled', coalesce((features->>'spaces')::boolean, true)
  ),
  jsonb_build_object(
    'key', 'vehicles',
    'enabled', coalesce((features->>'vehicles')::boolean, false)
  ),
  jsonb_build_object(
    'key', 'books',
    'enabled', coalesce((features->>'books')::boolean, false)
  )
)
where menu_order is null or menu_order = '[]'::jsonb;

update public.organizations
set menu_order = coalesce(menu_order, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'key', 'books',
    'enabled', coalesce((features->>'books')::boolean, false)
  )
)
where not exists (
  select 1
  from jsonb_array_elements(coalesce(menu_order, '[]'::jsonb)) as item
  where item->>'key' = 'books'
);
