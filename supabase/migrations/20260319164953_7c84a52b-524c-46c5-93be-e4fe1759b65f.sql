-- Fix club_name on camps to match the linked club (source of truth)
UPDATE camps c SET club_name = cl.name 
FROM clubs cl WHERE c.club_id = cl.id AND c.club_name != cl.name;

-- Fix price_per_child from synced_bookings average where camp price is 0
UPDATE camps c SET price_per_child = sub.avg_price
FROM (
  SELECT matched_camp_id, ROUND(AVG(total_amount)) as avg_price 
  FROM synced_bookings 
  WHERE matched_camp_id IS NOT NULL AND total_amount > 0 
  GROUP BY matched_camp_id
) sub
WHERE c.id = sub.matched_camp_id AND c.price_per_child = 0;