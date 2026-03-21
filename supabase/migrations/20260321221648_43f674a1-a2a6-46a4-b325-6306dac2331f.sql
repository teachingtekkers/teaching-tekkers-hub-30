-- Delete duplicate attendance rows, keeping only the most recent per booking+date
DELETE FROM attendance
WHERE id NOT IN (
  SELECT DISTINCT ON (synced_booking_id, date) id
  FROM attendance
  ORDER BY synced_booking_id, date, created_at DESC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS attendance_booking_date_unique
ON attendance (synced_booking_id, date)
WHERE synced_booking_id IS NOT NULL;