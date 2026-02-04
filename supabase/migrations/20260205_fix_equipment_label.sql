-- Fix '장비' to '물품' in menu_labels for backward compatibility
-- This migration updates any existing '장비' labels to '물품'

UPDATE public.organizations
SET menu_labels = jsonb_set(
  menu_labels,
  '{equipment}',
  '"물품"'
)
WHERE menu_labels->>'equipment' = '장비';
