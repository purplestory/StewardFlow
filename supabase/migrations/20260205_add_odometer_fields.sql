-- Add odometer fields for vehicles
-- This migration adds current_odometer to vehicles table and 
-- start_odometer_reading, distance_traveled to vehicle_reservations table

-- Add current_odometer to vehicles table
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS current_odometer integer;
  END IF;
END $$;

-- Add start_odometer_reading and distance_traveled to vehicle_reservations table
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicle_reservations') THEN
    ALTER TABLE public.vehicle_reservations
    ADD COLUMN IF NOT EXISTS start_odometer_reading integer, -- 대여 시 초기 주행거리
    ADD COLUMN IF NOT EXISTS distance_traveled integer; -- 실제 운행거리 (최종 - 초기)
  END IF;
END $$;
