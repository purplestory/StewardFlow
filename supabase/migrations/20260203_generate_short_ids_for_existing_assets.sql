-- Generate short_ids for existing assets that don't have one
-- This uses a simple approach: take first 8 characters of UUID (without hyphens) + random suffix
-- For production, you might want to use a proper nanoid generation in your application

-- Function to generate a short ID from UUID
CREATE OR REPLACE FUNCTION generate_short_id_from_uuid()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update existing assets without short_id
UPDATE public.assets
SET short_id = generate_short_id_from_uuid()
WHERE short_id IS NULL;

-- Update existing spaces without short_id
UPDATE public.spaces
SET short_id = generate_short_id_from_uuid()
WHERE short_id IS NULL;

-- Note: If there are collisions, you may need to run this multiple times
-- or handle collisions in your application code
