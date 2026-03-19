-- Add new columns to session_plans for Teaching Tekkers format
ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS organisation text,
  ADD COLUMN IF NOT EXISTS other_comments text,
  ADD COLUMN IF NOT EXISTS coaching_points text,
  ADD COLUMN IF NOT EXISTS player_numbers text,
  ADD COLUMN IF NOT EXISTS equipment text,
  ADD COLUMN IF NOT EXISTS diagram_image_url text;

-- Seed the required categories (skip if already exist)
INSERT INTO public.session_plan_categories (id, name) VALUES
  (gen_random_uuid(), 'Warm Ups'),
  (gen_random_uuid(), 'Dribbling'),
  (gen_random_uuid(), 'Passing'),
  (gen_random_uuid(), 'Crossing'),
  (gen_random_uuid(), 'Finishing'),
  (gen_random_uuid(), 'Ball Protection & Turning'),
  (gen_random_uuid(), '1v1 Games'),
  (gen_random_uuid(), 'Small Sided Games'),
  (gen_random_uuid(), 'Camp Games')
ON CONFLICT DO NOTHING;