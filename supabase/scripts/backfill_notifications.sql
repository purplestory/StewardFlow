-- 알림 payload에 resource_name을 채우는 백필 스크립트
-- 실행 전: 알림 payload에 resource_id가 있어야 합니다.

update public.notifications
set payload = jsonb_set(
  payload,
  '{resource_name}',
  to_jsonb(assets.name),
  true
)
from public.assets
where
  payload ? 'resource_id'
  and (payload->>'resource_name') is null
  and payload->>'resource_id' = assets.id::text;

update public.notifications
set payload = jsonb_set(
  payload,
  '{resource_name}',
  to_jsonb(spaces.name),
  true
)
from public.spaces
where
  payload ? 'resource_id'
  and (payload->>'resource_name') is null
  and payload->>'resource_id' = spaces.id::text;
