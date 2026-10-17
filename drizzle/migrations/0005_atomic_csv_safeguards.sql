ALTER TABLE public.booking_import_runs ADD COLUMN IF NOT EXISTS safety_snapshot jsonb;
ALTER TABLE public.booking_import_runs ADD COLUMN IF NOT EXISTS safety_version integer;
ALTER TABLE public.booking_import_run_rows ADD COLUMN IF NOT EXISTS decision_by uuid;
ALTER TABLE public.booking_import_run_rows ADD COLUMN IF NOT EXISTS decision_at timestamptz;
CREATE TABLE public.booking_import_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES public.booking_import_runs(id), target_table text NOT NULL, target_id uuid NOT NULL, before_state jsonb, after_state jsonb NOT NULL, operation text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.booking_import_changes TO authenticated;
GRANT ALL ON public.booking_import_changes TO service_role;
ALTER TABLE public.booking_import_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read atomic import audit" ON public.booking_import_changes FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.csv_safety_snapshot() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object('players',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.players t),'[]'::jsonb),'synced_bookings',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.synced_bookings t),'[]'::jsonb),'bookings',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.bookings t),'[]'::jsonb),'camps',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.camps t),'[]'::jsonb),'mappings',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.source_camp_mappings t),'[]'::jsonb),'families',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.source_family_bookings t),'[]'::jsonb),'attendance',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.attendance t),'[]'::jsonb),'held_audits',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.data_repair_audit t WHERE status IN ('held','staged')),'[]'::jsonb),'pending_rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.booking_import_run_rows t WHERE review_status='pending'),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.csv_safety_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.csv_safety_snapshot() TO service_role;
CREATE OR REPLACE FUNCTION public.stage_csv_safety_run(payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; r jsonb;
BEGIN
IF NOT public.has_role((payload->>'user_id')::uuid,'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
IF payload->'snapshot' IS DISTINCT FROM public.csv_safety_snapshot() THEN RAISE EXCEPTION 'Evidence changed while preparing preview; preview again'; END IF;
IF jsonb_array_length(payload->'rows') NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Invalid row count'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.source_camp_mappings WHERE source_system=payload->>'source_system' AND source_camp_id=payload->>'source_camp_id' AND camp_id=(payload->>'camp_id')::uuid) THEN RAISE EXCEPTION 'Verified source mapping required'; END IF;
INSERT INTO public.booking_import_runs(source_system,source_camp_id,camp_id,file_name,counts,created_by,trigger,safety_snapshot,safety_version) VALUES(payload->>'source_system',payload->>'source_camp_id',(payload->>'camp_id')::uuid,payload->>'file_name',payload->'counts',(payload->>'user_id')::uuid,'manual',payload->'snapshot',1) RETURNING id INTO rid;
FOR r IN SELECT value FROM jsonb_array_elements(payload->'rows') LOOP
INSERT INTO public.booking_import_run_rows(run_id,row_index,classification,reason,participant_key,family_key,synced_booking_id,candidate_ids,raw_row,normalized,diff,protected_fields,conflict) VALUES(rid,(r->>'row_index')::int,r->>'classification',r->>'reason',r->>'participant_key',r->>'family_key',(r->>'synced_booking_id')::uuid,ARRAY(SELECT jsonb_array_elements_text(r->'candidate_ids')),r->'raw_row',r->'normalized',r->'diff',ARRAY(SELECT jsonb_array_elements_text(r->'protected_fields')),coalesce((r->>'conflict')::boolean,false));
END LOOP; RETURN rid;
END; $$;
REVOKE ALL ON FUNCTION public.stage_csv_safety_run(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_csv_safety_run(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.save_csv_decisions(_run_id uuid,_decisions jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.booking_import_run_rows; d text;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
PERFORM 1 FROM public.booking_import_runs WHERE id=_run_id AND status='preview' AND safety_version=1 FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Preview not available'; END IF;
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
CREATE OR REPLACE FUNCTION public.commit_csv_safety_run(_run_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run public.booking_import_runs; r public.booking_import_run_rows; c public.camps; n jsonb; patch jsonb; oldrow jsonb; newrow jsonb; bid uuid; pid uuid; fid uuid; ext text; k text; v jsonb; sb public.synced_bookings; created_n int:=0; updated_n int:=0; unchanged_n int:=0; skipped_n int:=0; result jsonb;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
LOCK TABLE public.players,public.synced_bookings,public.bookings,public.camps,public.source_camp_mappings,public.source_family_bookings,public.attendance,public.data_repair_audit,public.booking_import_runs,public.booking_import_run_rows IN SHARE ROW EXCLUSIVE MODE;
SELECT * INTO run FROM public.booking_import_runs WHERE id=_run_id FOR UPDATE;
IF NOT FOUND OR run.safety_version IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Create a fresh safety preview'; END IF;
IF run.status='committed' THEN RETURN jsonb_build_object('status','committed','result',run.counts->'result','replayed',true); END IF;
IF run.status<>'preview' THEN RAISE EXCEPTION 'Run is not a preview'; END IF;
IF run.safety_snapshot IS DISTINCT FROM public.csv_safety_snapshot() THEN RAISE EXCEPTION 'Stale preview: matching, mapping, staff values or dependencies changed; no changes committed'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.source_camp_mappings WHERE source_system=run.source_system AND source_camp_id=run.source_camp_id AND camp_id=run.camp_id) THEN RAISE EXCEPTION 'Mapping changed'; END IF;
SELECT * INTO c FROM public.camps WHERE id=run.camp_id;
UPDATE public.booking_import_runs SET status='committing',locked_at=now() WHERE id=run.id;
FOR r IN SELECT * FROM public.booking_import_run_rows WHERE run_id=run.id ORDER BY row_index FOR UPDATE LOOP
IF r.classification='rejected' THEN skipped_n:=skipped_n+1; CONTINUE; END IF;
IF r.classification='ambiguous' THEN
IF r.resolution IS DISTINCT FROM 'skip' OR r.decision_by IS NULL THEN RAISE EXCEPTION 'Save skip decisions for unresolved rows before commit'; END IF;
skipped_n:=skipped_n+1;
UPDATE public.booking_import_run_rows SET review_status='pending',applied=false WHERE id=r.id;
CONTINUE;
END IF;
n:=r.normalized-'_safety_hold'-'_profile_id'-'_destination_camp'-'source_participant_id'-'source_booking_id';
IF n->>'amount_owed' IS NULL OR coalesce((n->>'refund_amount')::numeric,0)>0 OR coalesce(n->>'booking_status','') ILIKE '%cancel%' THEN RAISE EXCEPTION 'Refund/cancellation must be held'; END IF;
FOR k IN SELECT unnest(ARRAY['total_amount','amount_paid','refund_amount','sibling_discount']) LOOP
IF n->>k IS NULL OR n->>k !~ '^[0-9]+(\.[0-9]{1,2})?$' OR (n->>k)::numeric>1000000 THEN RAISE EXCEPTION 'Invalid money %',k; END IF;
END LOOP;
IF (n->>'amount_owed')::numeric<>greatest(0,(n->>'total_amount')::numeric-(n->>'amount_paid')::numeric) THEN RAISE EXCEPTION 'Invalid computed owed'; END IF;
IF n->>'date_of_birth' IS NOT NULL THEN PERFORM (n->>'date_of_birth')::date; END IF;
IF n->>'booking_date' IS NOT NULL THEN PERFORM (n->>'booking_date')::date; END IF;
IF r.classification='new' THEN
IF n->>'date_of_birth' IS NULL OR (coalesce(n->>'parent_email','')='' AND coalesce(n->>'parent_phone','')='') THEN RAISE EXCEPTION 'Identity requires DOB and guardian contact'; END IF;
pid:=(r.normalized->>'_profile_id')::uuid;
IF pid IS NULL THEN
INSERT INTO public.players(first_name,last_name,date_of_birth,guardian_email,guardian_phone,identity_key) VALUES(n->>'child_first_name',n->>'child_last_name',(n->>'date_of_birth')::date,n->>'parent_email',n->>'parent_phone','csv-safe:'||r.participant_key) RETURNING id INTO pid;
SELECT to_jsonb(t) INTO newrow FROM public.players t WHERE id=pid;
INSERT INTO public.booking_import_changes(run_id,target_table,target_id,operation,after_state) VALUES(run.id,'players',pid,'insert',newrow);
ELSE
IF NOT EXISTS(SELECT 1 FROM public.players WHERE id=pid) THEN RAISE EXCEPTION 'Profile disappeared'; END IF;
END IF;
SELECT id INTO fid FROM public.source_family_bookings WHERE source_system=run.source_system AND source_camp_id=run.source_camp_id AND family_key=r.family_key;
IF fid IS NULL THEN
INSERT INTO public.source_family_bookings(source_system,source_camp_id,family_key,source_booking_id,guardian_name,guardian_email,guardian_phone,first_import_run_id,last_import_run_id) VALUES(run.source_system,run.source_camp_id,r.family_key,r.normalized->>'source_booking_id',n->>'parent_name',n->>'parent_email',n->>'parent_phone',run.id,run.id) RETURNING id INTO fid;
SELECT to_jsonb(t) INTO newrow FROM public.source_family_bookings t WHERE id=fid;
INSERT INTO public.booking_import_changes(run_id,target_table,target_id,operation,after_state) VALUES(run.id,'source_family_bookings',fid,'insert',newrow);
END IF;
ext:='src:'||run.source_camp_id||':'||coalesce(nullif(r.normalized->>'source_participant_id',''),r.participant_key);
IF EXISTS(SELECT 1 FROM public.synced_bookings WHERE (source_system=run.source_system AND external_booking_id=ext) OR (matched_camp_id=run.camp_id AND matched_player_id=pid)) THEN RAISE EXCEPTION 'Destination registration already exists; preview again'; END IF;
patch:=n||jsonb_build_object('id',gen_random_uuid(),'external_booking_id',ext,'source_system',run.source_system,'source_camp_id',run.source_camp_id,'source_participant_id',r.normalized->>'source_participant_id','source_booking_id',r.normalized->>'source_booking_id','participant_key',r.participant_key,'family_booking_id',fid,'matched_player_id',pid,'matched_camp_id',c.id,'camp_name',c.name,'camp_date',c.start_date,'venue',c.venue,'county',c.county,'source_values',n,'last_import_run_id',run.id,'kit_given',false,'manual_override',false,'duplicate_warning',false,'needs_admin_review',false,'match_status','matched','imported_at',now(),'last_synced_at',now(),'created_at',now());
IF patch->>'kit_size' IS NULL THEN patch:=patch||jsonb_build_object('kit_size','M'); END IF;
sb:=jsonb_populate_record(NULL::public.synced_bookings,patch);
INSERT INTO public.synced_bookings SELECT (sb).* RETURNING id INTO bid;
SELECT to_jsonb(t) INTO newrow FROM public.synced_bookings t WHERE id=bid;
INSERT INTO public.booking_import_changes(run_id,target_table,target_id,operation,after_state) VALUES(run.id,'synced_bookings',bid,'insert',newrow);
created_n:=created_n+1;
ELSE
bid:=r.synced_booking_id;
SELECT to_jsonb(t) INTO oldrow FROM public.synced_bookings t WHERE id=bid FOR UPDATE;
IF oldrow IS NULL THEN RAISE EXCEPTION 'Registration missing'; END IF;
patch:='{}'::jsonb;
FOR k,v IN SELECT key,value FROM jsonb_each(coalesce(r.diff,'{}'::jsonb)) LOOP
IF k<>ALL(ARRAY['child_first_name','child_last_name','parent_name','parent_phone','parent_email','emergency_contact','alternate_phone','date_of_birth','age','booking_date','booking_status','kit_size','total_amount','sibling_discount','amount_paid','refund_amount','amount_owed','payment_status','payment_type']) THEN RAISE EXCEPTION 'Protected medical/consent or unsupported field requires review'; END IF;
IF oldrow->k IS DISTINCT FROM v->'from' THEN RAISE EXCEPTION 'Changed before-state'; END IF;
patch:=patch||jsonb_build_object(k,v->'to');
END LOOP;
IF patch='{}'::jsonb THEN unchanged_n:=unchanged_n+1;
ELSE
sb:=jsonb_populate_record(NULL::public.synced_bookings,oldrow||patch||jsonb_build_object('source_values',n,'last_import_run_id',run.id,'last_synced_at',now()));
UPDATE public.synced_bookings SET child_first_name=sb.child_first_name,child_last_name=sb.child_last_name,parent_name=sb.parent_name,parent_phone=sb.parent_phone,parent_email=sb.parent_email,emergency_contact=sb.emergency_contact,alternate_phone=sb.alternate_phone,date_of_birth=sb.date_of_birth,age=sb.age,booking_date=sb.booking_date,booking_status=sb.booking_status,kit_size=sb.kit_size,total_amount=sb.total_amount,sibling_discount=sb.sibling_discount,amount_paid=sb.amount_paid,refund_amount=sb.refund_amount,amount_owed=sb.amount_owed,payment_status=sb.payment_status,payment_type=sb.payment_type,source_values=sb.source_values,last_import_run_id=sb.last_import_run_id,last_synced_at=sb.last_synced_at WHERE id=bid;
SELECT to_jsonb(t) INTO newrow FROM public.synced_bookings t WHERE id=bid;
INSERT INTO public.booking_import_changes(run_id,target_table,target_id,operation,before_state,after_state) VALUES(run.id,'synced_bookings',bid,'update',oldrow,newrow);
updated_n:=updated_n+1;
END IF;
END IF;
UPDATE public.booking_import_run_rows SET applied=true,synced_booking_id=bid WHERE id=r.id;
END LOOP;
result:=jsonb_build_object('created',created_n,'updated',updated_n,'unchanged',unchanged_n,'skipped',skipped_n,'protected_rows',0,'pending_review',skipped_n);
UPDATE public.booking_import_runs SET status='committed',committed_at=now(),locked_at=NULL,counts=counts||jsonb_build_object('result',result) WHERE id=run.id;
RETURN jsonb_build_object('status','committed','result',result,'replayed',false);
END; $$;
REVOKE ALL ON FUNCTION public.commit_csv_safety_run(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.commit_csv_safety_run(uuid) TO authenticated;
COMMENT ON FUNCTION public.commit_csv_safety_run(uuid) IS 'Admin-authorized atomic manual CSV commit. Global snapshot guard intentionally aborts on any relevant-table change. No automatic commit.';
REVOKE INSERT,UPDATE,DELETE ON public.booking_import_runs,public.booking_import_run_rows FROM authenticated,anon;
GRANT SELECT ON public.booking_import_runs,public.booking_import_run_rows TO authenticated;