
-- Merge duplicate players: relink bookings & attendance, delete non-canonical
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
      IF dup_id != r.canonical_id THEN
        UPDATE public.synced_bookings SET matched_player_id = r.canonical_id WHERE matched_player_id = dup_id;
        UPDATE public.attendance SET player_id = r.canonical_id WHERE player_id = dup_id;
        DELETE FROM public.players WHERE id = dup_id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS players_identity_key_uniq ON public.players (identity_key) WHERE identity_key IS NOT NULL;
