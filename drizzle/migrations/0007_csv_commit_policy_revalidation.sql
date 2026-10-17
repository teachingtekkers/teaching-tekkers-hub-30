CREATE OR REPLACE FUNCTION public.csv_validate_existing_patch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE runid uuid; prev jsonb; f text;
BEGIN
runid:=NEW.last_import_run_id;
IF runid IS NOT DISTINCT FROM OLD.last_import_run_id OR NOT EXISTS(SELECT 1 FROM public.booking_import_runs WHERE id=runid AND safety_version=1 AND status='committing') THEN RETURN NEW; END IF;
IF OLD.needs_admin_review OR OLD.duplicate_warning OR EXISTS(SELECT 1 FROM public.data_repair_audit WHERE target_table='synced_bookings' AND target_id=OLD.id AND status IN ('held','staged')) THEN RAISE EXCEPTION 'Protected historical hold'; END IF;
IF ROW(NEW.medical_notes,NEW.medical_condition,NEW.photo_permission,NEW.kit_given,NEW.staff_notes,NEW.notes,NEW.manual_override,NEW.matched_camp_id,NEW.matched_player_id) IS DISTINCT FROM ROW(OLD.medical_notes,OLD.medical_condition,OLD.photo_permission,OLD.kit_given,OLD.staff_notes,OLD.notes,OLD.manual_override,OLD.matched_camp_id,OLD.matched_player_id) THEN RAISE EXCEPTION 'Protected staff medical consent or link values'; END IF;
IF NEW.kit_size IS DISTINCT FROM OLD.kit_size AND OLD.kit_given THEN RAISE EXCEPTION 'Issued kit size is protected'; END IF;
prev:=OLD.source_values;
FOR f IN SELECT unnest(ARRAY['total_amount','sibling_discount','amount_paid','refund_amount','amount_owed','payment_status','payment_type']) LOOP
IF to_jsonb(NEW)->f IS DISTINCT FROM to_jsonb(OLD)->f THEN
IF OLD.manual_override OR prev IS NULL OR to_jsonb(OLD)->f IS DISTINCT FROM prev->f THEN RAISE EXCEPTION 'Staff financial values are protected'; END IF;
END IF;
END LOOP;
RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.csv_validate_existing_patch() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER csv_existing_patch_policy BEFORE UPDATE ON public.synced_bookings FOR EACH ROW EXECUTE FUNCTION public.csv_validate_existing_patch();
CREATE OR REPLACE FUNCTION public.save_csv_decisions(_run_id uuid,_decisions jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.booking_import_run_rows; d text; st text;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
SELECT status INTO st FROM public.booking_import_runs WHERE id=_run_id AND safety_version=1 FOR UPDATE;
IF st='committed' THEN RETURN; END IF;
IF st IS DISTINCT FROM 'preview' THEN RAISE EXCEPTION 'Preview not available'; END IF;
FOR r IN SELECT * FROM public.booking_import_run_rows WHERE run_id=_run_id ORDER BY row_index FOR UPDATE LOOP
d:=_decisions->>r.row_index::text;
IF r.classification='ambiguous' AND d IS NOT NULL THEN
IF d<>'skip' THEN RAISE EXCEPTION 'Identity and field conflicts remain held; only skip is supported in this safety milestone'; END IF;
UPDATE public.booking_import_run_rows SET resolution=d,decision_by=auth.uid(),decision_at=now() WHERE id=r.id;
ELSIF d IS NOT NULL THEN RAISE EXCEPTION 'Decision supplied for a non-review row'; END IF;
END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.save_csv_decisions(uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_csv_decisions(uuid,jsonb) TO authenticated;