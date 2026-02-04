-- 알림 payload에 resource_image_url을 채우는 백필 스크립트

update public.notifications
set payload = jsonb_set(
  payload,
  '{resource_image_url}',
  to_jsonb(assets.image_url),
  true
)
from public.assets
where
  payload ? 'resource_id'
  and (payload->>'resource_image_url') is null
  and payload->>'resource_id' = assets.id::text;

update public.notifications
set payload = jsonb_set(
  payload,
  '{resource_image_url}',
  to_jsonb(spaces.image_url),
  true
)
from public.spaces
where
  payload ? 'resource_id'
  and (payload->>'resource_image_url') is null
  and payload->>'resource_id' = spaces.id::text;
