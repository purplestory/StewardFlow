-- Ensure vehicles and vehicle_reservations tables exist
-- This migration ensures the tables are created even if previous migrations failed

-- Create vehicles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id text,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text NOT NULL,
  image_url text,
  image_urls text[] DEFAULT '{}',
  category text,
  owner_scope text DEFAULT 'organization',
  owner_department text NOT NULL,
  location text,
  status text DEFAULT 'available',
  note text,
  managed_by_department text,
  license_plate text,
  vehicle_type text,
  fuel_type text,
  capacity integer
);

-- Create unique index on short_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_short_id 
ON public.vehicles(short_id) 
WHERE short_id IS NOT NULL;

-- Create index on organization_id and short_id
CREATE INDEX IF NOT EXISTS idx_vehicles_org_short_id 
ON public.vehicles(organization_id, short_id) 
WHERE short_id IS NOT NULL;

-- Create vehicle_reservations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vehicle_reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) NOT NULL,
  borrower_id uuid REFERENCES public.profiles(id) NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  status text DEFAULT 'pending',
  note text,
  recurrence_type text DEFAULT 'none',
  recurrence_interval integer DEFAULT 1,
  recurrence_end_date timestamp with time zone,
  recurrence_days_of_week integer[],
  recurrence_day_of_month integer,
  parent_reservation_id uuid REFERENCES public.vehicle_reservations(id),
  is_recurring_instance boolean DEFAULT false
);

-- Migrate existing image_url to image_urls array for vehicles (if any exist)
UPDATE public.vehicles
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND image_url != ''
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);
