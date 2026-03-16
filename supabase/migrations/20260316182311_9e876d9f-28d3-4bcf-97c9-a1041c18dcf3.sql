ALTER TABLE public.players ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE public.players ALTER COLUMN photo_permission SET DEFAULT false;