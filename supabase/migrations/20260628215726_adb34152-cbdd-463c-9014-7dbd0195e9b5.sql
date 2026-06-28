CREATE OR REPLACE FUNCTION public.prevent_head_coach_non_kit_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'head_coach'::app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
  THEN
    IF NEW IS DISTINCT FROM OLD THEN
      IF ROW(
        NEW.id,
        NEW.external_booking_id,
        NEW.camp_name,
        NEW.camp_date,
        NEW.venue,
        NEW.county,
        NEW.child_first_name,
        NEW.child_last_name,
        NEW.date_of_birth,
        NEW.age,
        NEW.parent_name,
        NEW.parent_phone,
        NEW.parent_email,
        NEW.emergency_contact,
        NEW.medical_notes,
        NEW.booking_status,
        NEW.source_system,
        NEW.imported_at,
        NEW.last_synced_at,
        NEW.sync_log_id,
        NEW.matched_camp_id,
        NEW.matched_player_id,
        NEW.matched_booking_id,
        NEW.match_status,
        NEW.duplicate_warning,
        NEW.notes,
        NEW.created_at,
        NEW.photo_permission,
        NEW.staff_notes,
        NEW.total_amount,
        NEW.sibling_discount,
        NEW.refund_amount,
        NEW.payment_type,
        NEW.medical_condition,
        NEW.alternate_phone,
        NEW.booking_date,
        NEW.match_score,
        NEW.match_reason,
        NEW.manual_override,
        NEW.attendance_source,
        NEW.evidence_type,
        NEW.sign_in_confidence,
        NEW.needs_admin_review
      ) IS DISTINCT FROM ROW(
        OLD.id,
        OLD.external_booking_id,
        OLD.camp_name,
        OLD.camp_date,
        OLD.venue,
        OLD.county,
        OLD.child_first_name,
        OLD.child_last_name,
        OLD.date_of_birth,
        OLD.age,
        OLD.parent_name,
        OLD.parent_phone,
        OLD.parent_email,
        OLD.emergency_contact,
        OLD.medical_notes,
        OLD.booking_status,
        OLD.source_system,
        OLD.imported_at,
        OLD.last_synced_at,
        OLD.sync_log_id,
        OLD.matched_camp_id,
        OLD.matched_player_id,
        OLD.matched_booking_id,
        OLD.match_status,
        OLD.duplicate_warning,
        OLD.notes,
        OLD.created_at,
        OLD.photo_permission,
        OLD.staff_notes,
        OLD.total_amount,
        OLD.sibling_discount,
        OLD.refund_amount,
        OLD.payment_type,
        OLD.medical_condition,
        OLD.alternate_phone,
        OLD.booking_date,
        OLD.match_score,
        OLD.match_reason,
        OLD.manual_override,
        OLD.attendance_source,
        OLD.evidence_type,
        OLD.sign_in_confidence,
        OLD.needs_admin_review
      ) THEN
        RAISE EXCEPTION 'Head coaches can only update kit size, kit received, and paid status';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;