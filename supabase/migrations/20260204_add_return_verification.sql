-- Add return verification policy to organizations
-- Only add column if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS return_verification_policy jsonb DEFAULT '{
      "enabled": false,
      "require_photo": true,
      "require_verification": true
    }'::jsonb;
  END IF;
END $$;

-- Add return verification fields to reservations (assets)
-- Only add columns if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
    ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS return_images text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS return_status text DEFAULT 'pending', -- 'pending', 'returned', 'verified', 'rejected'
    ADD COLUMN IF NOT EXISTS return_note text,
    ADD COLUMN IF NOT EXISTS return_verified_by uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS return_verified_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS return_condition text; -- 'good', 'damaged', 'missing_parts', etc.
  END IF;
END $$;

-- Add return verification fields to space_reservations
-- Only add columns if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'space_reservations') THEN
    ALTER TABLE public.space_reservations
    ADD COLUMN IF NOT EXISTS return_images text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS return_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS return_note text,
    ADD COLUMN IF NOT EXISTS return_verified_by uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS return_verified_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS return_condition text;
  END IF;
END $$;

-- Add return verification fields to vehicle_reservations (with special fields for vehicles)
-- Only add columns if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicle_reservations') THEN
    ALTER TABLE public.vehicle_reservations
    ADD COLUMN IF NOT EXISTS return_images text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS return_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS return_note text,
    ADD COLUMN IF NOT EXISTS return_verified_by uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS return_verified_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS return_condition text,
    ADD COLUMN IF NOT EXISTS vehicle_odometer_image text, -- 계기판 사진
    ADD COLUMN IF NOT EXISTS vehicle_exterior_image text, -- 외관 사진
    ADD COLUMN IF NOT EXISTS odometer_reading integer; -- 주행거리
  END IF;
END $$;

-- Update status check constraint to include return_status
-- Note: This is informational, actual constraints are handled in application logic
