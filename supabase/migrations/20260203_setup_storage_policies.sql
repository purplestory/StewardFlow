-- Setup Storage policies for asset-images bucket
-- This ensures authenticated users can upload and everyone can read

-- Note: This assumes the bucket 'asset-images' already exists
-- If it doesn't exist, create it first in Supabase Dashboard:
-- Storage → New bucket → Name: asset-images → Public bucket: ON

-- Policy: Allow authenticated users to upload files
INSERT INTO storage.policies (bucket_id, name, definition, check_expression, role)
SELECT 
  id,
  'Allow authenticated uploads',
  '(bucket_id = ''asset-images''::text)',
  '(bucket_id = ''asset-images''::text)',
  'authenticated'
FROM storage.buckets
WHERE name = 'asset-images'
ON CONFLICT DO NOTHING;

-- Policy: Allow public read access
INSERT INTO storage.policies (bucket_id, name, definition, check_expression, role)
SELECT 
  id,
  'Allow public reads',
  '(bucket_id = ''asset-images''::text)',
  '(bucket_id = ''asset-images''::text)',
  'public'
FROM storage.buckets
WHERE name = 'asset-images'
ON CONFLICT DO NOTHING;

-- Alternative: Use RLS policies if the above doesn't work
-- Make sure the bucket is set to public in Supabase Dashboard first
