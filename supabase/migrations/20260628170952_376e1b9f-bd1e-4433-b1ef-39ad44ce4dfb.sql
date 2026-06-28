CREATE POLICY "Head coaches read assigned camp bookings"
ON public.synced_bookings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'head_coach'::app_role)
  AND matched_camp_id IN (
    SELECT cca.camp_id
    FROM public.camp_coach_assignments cca
    JOIN public.profiles p ON p.coach_id = cca.coach_id
    WHERE p.id = auth.uid()
  )
);