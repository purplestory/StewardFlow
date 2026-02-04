-- Add image_urls array column to assets and spaces tables
-- This allows storing multiple images per asset/space
-- image_url is kept for backward compatibility

ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- Migrate existing image_url to image_urls array
-- If image_url exists, add it as the first element in image_urls
UPDATE public.assets
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND image_url != ''
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

UPDATE public.spaces
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND image_url != ''
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);
