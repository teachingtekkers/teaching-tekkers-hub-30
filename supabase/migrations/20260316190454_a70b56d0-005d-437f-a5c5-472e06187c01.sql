ALTER TABLE public.players
ALTER COLUMN date_of_birth DROP NOT NULL;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS identity_key text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS norm_first_name text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS norm_last_name text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS guardian_email text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS guardian_phone text;

WITH linked_guardians AS (
  SELECT DISTINCT ON (sb.matched_player_id)
    sb.matched_player_id AS player_id,
    NULLIF(lower(trim(sb.parent_email)), '') AS guardian_email,
    NULLIF(regexp_replace(coalesce(sb.parent_phone, ''), '\D', '', 'g'), '') AS guardian_phone
  FROM public.synced_bookings sb
  WHERE sb.matched_player_id IS NOT NULL
  ORDER BY sb.matched_player_id, sb.imported_at DESC
)
UPDATE public.players p
SET guardian_email = COALESCE(NULLIF(lower(trim(p.guardian_email)), ''), lg.guardian_email),
    guardian_phone = COALESCE(NULLIF(regexp_replace(coalesce(p.guardian_phone, ''), '\D', '', 'g'), ''), lg.guardian_phone)
FROM linked_guardians lg
WHERE lg.player_id = p.id;

UPDATE public.players
SET norm_first_name = lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))),
    norm_last_name = lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))),
    guardian_email = NULLIF(lower(trim(guardian_email)), ''),
    guardian_phone = NULLIF(regexp_replace(coalesce(guardian_phone, ''), '\D', '', 'g'), ''),
    identity_key = CASE
      WHEN date_of_birth IS NOT NULL THEN
        lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))) || '|' || lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))) || '|' || date_of_birth::text
      WHEN NULLIF(lower(trim(guardian_email)), '') IS NOT NULL THEN
        lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))) || '|' || lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))) || '|email|' || lower(trim(guardian_email))
      WHEN NULLIF(regexp_replace(coalesce(guardian_phone, ''), '\D', '', 'g'), '') IS NOT NULL THEN
        lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))) || '|' || lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))) || '|phone|' || regexp_replace(guardian_phone, '\D', '', 'g')
      ELSE
        lower(trim(regexp_replace(first_name, '\s+', ' ', 'g'))) || '|' || lower(trim(regexp_replace(last_name, '\s+', ' ', 'g'))) || '|nodob'
    END;

DO $$
DECLARE
  r RECORD;
  dup_id uuid;
BEGIN
  FOR r IN
    SELECT identity_key,
           (array_agg(id ORDER BY created_at ASC))[1] AS canonical_id,
           array_agg(id ORDER BY created_at ASC) AS all_ids
    FROM public.players
    WHERE identity_key IS NOT NULL
    GROUP BY identity_key
    HAVING count(*) > 1
  LOOP
    FOREACH dup_id IN ARRAY r.all_ids
    LOOP
      IF dup_id <> r.canonical_id THEN
        UPDATE public.synced_bookings
        SET matched_player_id = r.canonical_id
        WHERE matched_player_id = dup_id;

        UPDATE public.attendance
        SET player_id = r.canonical_id
        WHERE player_id = dup_id;

        DELETE FROM public.players WHERE id = dup_id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.players_identity_key_uniq;
CREATE UNIQUE INDEX players_identity_key_uniq ON public.players (identity_key);