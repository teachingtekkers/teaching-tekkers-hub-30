
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS norm_first_name text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS norm_last_name text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS guardian_email text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS identity_key text;

UPDATE public.players SET
  norm_first_name = lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))),
  norm_last_name = lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))),
  identity_key = CASE
    WHEN date_of_birth IS NOT NULL THEN
      lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))) || '|' || lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))) || '|' || date_of_birth::text
    ELSE
      lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))) || '|' || lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))) || '|nodob'
  END;
