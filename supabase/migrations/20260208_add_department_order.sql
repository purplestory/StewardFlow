-- Add department_order column to organizations table for custom ordering
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS department_order jsonb DEFAULT '[]'::jsonb;
