
WITH club_keys AS (
  SELECT id AS booking_id,
         trim(regexp_replace(camp_name, '\s*(Summer|Easter|May|Christmas|Halloween|Mid[- ]?Term).*$', '', 'i')) AS club_key
  FROM synced_bookings
  WHERE matched_camp_id IS NULL
),
candidates AS (
  SELECT DISTINCT ck.booking_id, c.id AS camp_id
  FROM club_keys ck
  JOIN camps c
    ON c.status <> 'archived'
   AND c.start_date >= '2026-06-01' AND c.start_date < '2026-09-01'
   AND (lower(c.club_name) = lower(ck.club_key)
        OR lower(c.club_name) LIKE lower(ck.club_key) || '%'
        OR lower(ck.club_key) LIKE lower(c.club_name) || '%')
),
uniq AS (
  SELECT booking_id, MAX(camp_id::text)::uuid AS camp_id
  FROM candidates
  GROUP BY booking_id
  HAVING COUNT(*) = 1
)
UPDATE synced_bookings sb
SET matched_camp_id = u.camp_id, match_status = 'matched'
FROM uniq u
WHERE sb.id = u.booking_id;
