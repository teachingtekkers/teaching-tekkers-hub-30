DROP FUNCTION IF EXISTS public.update_assigned_booking_kit(uuid, text, boolean);

DROP POLICY IF EXISTS "Head coaches update assigned booking kit" ON public.synced_bookings;

CREATE POLICY "Head coaches update assigned booking kit"
ON public.synced_bookings
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'head_coach'::app_role)
  AND matched_camp_id IN (
    SELECT cca.camp_id
    FROM public.camp_coach_assignments cca
    JOIN public.profiles p ON p.coach_id = cca.coach_id
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'head_coach'::app_role)
  AND matched_camp_id IN (
    SELECT cca.camp_id
    FROM public.camp_coach_assignments cca
    JOIN public.profiles p ON p.coach_id = cca.coach_id
    WHERE p.id = auth.uid()
  )
);

REVOKE UPDATE ON public.synced_bookings FROM anon;
REVOKE UPDATE ON public.synced_bookings FROM authenticated;
GRANT UPDATE (
  external_booking_id,
  camp_name,
  camp_date,
  venue,
  county,
  child_first_name,
  child_last_name,
  date_of_birth,
  age,
  parent_name,
  parent_phone,
  parent_email,
  emergency_contact,
  medical_notes,
  kit_size,
  payment_status,
  booking_status,
  source_system,
  last_synced_at,
  sync_log_id,
  matched_camp_id,
  matched_player_id,
  matched_booking_id,
  match_status,
  duplicate_warning,
  notes,
  amount_paid,
  amount_owed,
  photo_permission,
  staff_notes,
  total_amount,
  sibling_discount,
  refund_amount,
  payment_type,
  medical_condition,
  alternate_phone,
  booking_date,
  kit_given,
  match_score,
  match_reason,
  manual_override,
  attendance_source,
  evidence_type,
  sign_in_confidence,
  needs_admin_review
) ON public.synced_bookings TO authenticated;