-- Preview staging timed out (57014) comparing a multi-MB round-tripped snapshot payload.
-- Replace full-payload comparison with a server-computed digest of the identical snapshot.
CREATE OR REPLACE FUNCTION public.csv_safety_evidence()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('snapshot', s, 'digest', md5(s::text)) FROM (SELECT public.csv_safety_snapshot() s) x;
$$;
CREATE OR REPLACE FUNCTION public.csv_safety_snapshot_digest()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT md5(public.csv_safety_snapshot()::text);
$$;
REVOKE ALL ON FUNCTION public.csv_safety_evidence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.csv_safety_snapshot_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.csv_safety_evidence() TO service_role;
GRANT EXECUTE ON FUNCTION public.csv_safety_snapshot_digest() TO service_role;

CREATE OR REPLACE FUNCTION public.stage_csv_safety_run(payload jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE rid uuid; r jsonb; d text;
BEGIN
IF NOT public.has_role((payload->>'user_id')::uuid,'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
d := payload->>'snapshot_digest';
IF d IS NULL OR d !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'Safety evidence digest required; preview again'; END IF;
IF d IS DISTINCT FROM public.csv_safety_snapshot_digest() THEN RAISE EXCEPTION 'Evidence changed while preparing preview; preview again'; END IF;
IF jsonb_array_length(payload->'rows') NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Invalid row count'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.source_camp_mappings WHERE source_system=payload->>'source_system' AND source_camp_id=payload->>'source_camp_id' AND camp_id=(payload->>'camp_id')::uuid) THEN RAISE EXCEPTION 'Verified source mapping required'; END IF;
INSERT INTO public.booking_import_runs(source_system,source_camp_id,camp_id,file_name,counts,created_by,trigger,safety_snapshot,safety_version) VALUES(payload->>'source_system',payload->>'source_camp_id',(payload->>'camp_id')::uuid,payload->>'file_name',payload->'counts',(payload->>'user_id')::uuid,'manual',jsonb_build_object('digest',d),1) RETURNING id INTO rid;
FOR r IN SELECT value FROM jsonb_array_elements(payload->'rows') LOOP
INSERT INTO public.booking_import_run_rows(run_id,row_index,classification,reason,participant_key,family_key,synced_booking_id,candidate_ids,raw_row,normalized,diff,protected_fields,conflict) VALUES(rid,(r->>'row_index')::int,r->>'classification',r->>'reason',r->>'participant_key',r->>'family_key',(r->>'synced_booking_id')::uuid,ARRAY(SELECT jsonb_array_elements_text(r->'candidate_ids'))::uuid[],r->'raw_row',r->'normalized',r->'diff',ARRAY(SELECT jsonb_array_elements_text(r->'protected_fields')),coalesce((r->>'conflict')::boolean,false));
END LOOP; RETURN rid;
END; $function$;
REVOKE ALL ON FUNCTION public.stage_csv_safety_run(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_csv_safety_run(jsonb) TO service_role;

-- Commit: compare the stored digest (old full-snapshot previews have none -> stale, fail closed).
DO $do$
DECLARE def text; old_line text := 'IF run.safety_snapshot IS DISTINCT FROM public.csv_safety_snapshot() THEN';
BEGIN
  SELECT pg_get_functiondef('public.commit_csv_safety_run(uuid)'::regprocedure) INTO def;
  IF position(old_line IN def) = 0 THEN RAISE EXCEPTION 'commit_csv_safety_run snapshot check not found'; END IF;
  def := replace(def, old_line, 'IF (run.safety_snapshot->>''digest'') IS NULL OR (run.safety_snapshot->>''digest'') IS DISTINCT FROM public.csv_safety_snapshot_digest() THEN');
  EXECUTE def;
END $do$;