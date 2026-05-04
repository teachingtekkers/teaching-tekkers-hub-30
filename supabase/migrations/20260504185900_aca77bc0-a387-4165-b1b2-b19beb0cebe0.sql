-- 1. Fix the boys camp record
UPDATE public.camps
SET name = 'Portmarnock AFC May Camp 2026',
    venue = 'Portmarnock AFC Grounds',
    club_name = COALESCE(NULLIF(club_name,''), 'Portmarnock AFC')
WHERE id = '88753e2e-1da8-4c8a-8767-2a4cd405c135';

-- 2. Create the Girls Only May Camp
INSERT INTO public.camps (id, name, club_name, venue, county, age_group, start_date, end_date, daily_start_time, daily_end_time, capacity, price_per_child, is_auto_created, status)
VALUES (
  gen_random_uuid(),
  'GIRLS ONLY Portmarnock AFC May Camp 2026',
  'Portmarnock AFC',
  'Portmarnock AFC Grounds',
  COALESCE((SELECT county FROM public.camps WHERE id='88753e2e-1da8-4c8a-8767-2a4cd405c135'), ''),
  'U8-U12',
  '2026-04-25', '2026-04-28',
  '10:00', '15:00',
  40, 0, true, 'active'
);

-- 3. Re-match the GIRLS bookings to the new girls camp
UPDATE public.synced_bookings
SET matched_camp_id = (SELECT id FROM public.camps WHERE name='GIRLS ONLY Portmarnock AFC May Camp 2026' LIMIT 1),
    camp_name = 'GIRLS ONLY Portmarnock AFC May Camp 2026',
    venue = 'Portmarnock AFC Grounds'
WHERE matched_camp_id = '88753e2e-1da8-4c8a-8767-2a4cd405c135'
  AND venue ILIKE 'GIRLS ONLY%';

-- 4. Clean up the boys-camp bookings
UPDATE public.synced_bookings
SET camp_name = 'Portmarnock AFC May Camp 2026',
    venue = 'Portmarnock AFC Grounds'
WHERE matched_camp_id = '88753e2e-1da8-4c8a-8767-2a4cd405c135';