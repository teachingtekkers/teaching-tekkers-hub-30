-- Camp provisioning template (admin-only, private operator procedure).
-- Companion to docs/camp-provisioning-runbook.md.
--
-- Usage: replace the payload JSON in the `payload` assignment below with one
-- verified source camp, then execute the whole block as a single statement
-- through the privileged database query path. No public endpoint exists.
--
-- Guarantees:
--  * Serialized per source key via a transaction advisory lock taken BEFORE
--    any read/create — concurrent runs of the same source_camp_id queue.
--  * Camp creation and mapping insertion are atomic: if the mapping insert
--    loses a race (ON CONFLICT DO NOTHING inserts nothing), the block raises
--    and the whole transaction rolls back — the new camp is never committed
--    without its mapping (no orphan camps).
--  * Existing mappings are re-validated against the incoming event identity;
--    a conflicting mapping is HELD, not blindly reused.
--  * Candidate reuse requires FULL event identity: club, county, camp name,
--    start/end dates, daily start/end times and age group. Name-only or
--    date-only matches never reuse.
--  * Missing/invalid required fields HOLD (nothing is written).
--  * Every decision is audited in data_repair_audit (kind 'camp_provision').

DO $prov$
DECLARE
  payload jsonb := $json$
  {
    "source_system": "bookings.teachingtekkers.com",
    "source_camp_id": "000",
    "name": "Example Club Halloween Camp 2026",
    "club_name": "Example Club",
    "county": "Dublin",
    "venue": "",
    "start_date": "2026-10-27",
    "end_date": "2026-10-30",
    "daily_start_time": "10:00",
    "daily_end_time": "15:00",
    "age_group": "5-14",
    "capacity": 100,
    "price_per_child": 85,
    "evidence": {
      "source_url": "https://bookings.teachingtekkers.com/camp/000/edit",
      "verified_by": "operator",
      "verified_at": "2026-10-17",
      "notes": "sibling discount 10, service charge 7.50, football included, no kit"
    },
    "audit_batch": "camp_provision_YYYY_MM_DD"
  }
  $json$;

  v_system     text := payload->>'source_system';
  v_source_id  text := payload->>'source_camp_id';
  v_name       text := nullif(btrim(payload->>'name'), '');
  v_club       text := nullif(btrim(payload->>'club_name'), '');
  v_county     text := nullif(btrim(payload->>'county'), '');
  v_venue      text := nullif(btrim(coalesce(payload->>'venue', '')), '');
  v_start      date;
  v_end        date;
  v_tstart     time;
  v_tend       time;
  v_age        text := nullif(btrim(payload->>'age_group'), '');
  v_capacity   int;
  v_price      numeric;
  v_batch      text := payload->>'audit_batch';
  v_evidence   jsonb := coalesce(payload->'evidence', '{}'::jsonb);

  v_mapped_camp uuid;
  v_camp_id     uuid;
  v_candidates  uuid[];
  v_inserted    int;
  v_status      text;
  v_hold_reason text;
  v_audit_after jsonb;
BEGIN
  -- ---- validation: hold (write nothing) on any missing/invalid field ----
  IF v_system IS NULL OR v_source_id IS NULL OR v_batch IS NULL THEN
    RAISE EXCEPTION 'payload missing source_system, source_camp_id or audit_batch';
  END IF;

  BEGIN
    v_start := (payload->>'start_date')::date;
    v_end   := (payload->>'end_date')::date;
    v_tstart := (payload->>'daily_start_time')::time;
    v_tend   := (payload->>'daily_end_time')::time;
    v_capacity := (payload->>'capacity')::int;
    v_price    := (payload->>'price_per_child')::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'held'; v_hold_reason := 'unparseable date/time/capacity/price field';
  END;

  IF v_status IS NULL THEN
    IF v_name IS NULL OR v_club IS NULL OR v_county IS NULL OR v_age IS NULL
       OR v_start IS NULL OR v_end IS NULL OR v_tstart IS NULL OR v_tend IS NULL
       OR v_capacity IS NULL OR v_price IS NULL THEN
      v_status := 'held'; v_hold_reason := 'missing required field (name/club/county/dates/times/age_group/capacity/price)';
    ELSIF v_end < v_start THEN
      v_status := 'held'; v_hold_reason := 'end_date before start_date';
    ELSIF v_tend <= v_tstart THEN
      v_status := 'held'; v_hold_reason := 'daily_end_time not after daily_start_time';
    ELSIF v_capacity <= 0 THEN
      v_status := 'held'; v_hold_reason := 'capacity not positive';
    ELSIF v_price < 0 THEN
      v_status := 'held'; v_hold_reason := 'price negative';
    END IF;
  END IF;

  v_audit_after := jsonb_build_object(
    'source_system', v_system, 'source_camp_id', v_source_id,
    'name', v_name, 'club_name', v_club, 'county', v_county,
    'start_date', v_start, 'end_date', v_end,
    'daily_start_time', v_tstart, 'daily_end_time', v_tend,
    'age_group', v_age, 'capacity', v_capacity, 'price_per_child', v_price);

  IF v_status = 'held' THEN
    INSERT INTO data_repair_audit (batch, kind, target_table, target_id, status, before, after, evidence)
    VALUES (v_batch, 'camp_provision', 'camps', NULL, 'held', NULL,
            v_audit_after || jsonb_build_object('hold_reason', v_hold_reason), v_evidence);
    RETURN;
  END IF;

  -- ---- serialize by source key before any read/create ----
  PERFORM pg_advisory_xact_lock(hashtextextended(v_system || ':' || v_source_id, 0));

  -- ---- existing mapping: validate identity, hold on conflict ----
  SELECT camp_id INTO v_mapped_camp
  FROM source_camp_mappings
  WHERE source_system = v_system AND source_camp_id = v_source_id;

  IF v_mapped_camp IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM camps c
      WHERE c.id = v_mapped_camp
        AND c.name = v_name AND c.club_name = v_club AND c.county = v_county
        AND c.start_date = v_start AND c.end_date = v_end
        AND c.daily_start_time = v_tstart AND c.daily_end_time = v_tend
        AND c.age_group = v_age
    ) THEN
      INSERT INTO data_repair_audit (batch, kind, target_table, target_id, status, before, after, evidence)
      VALUES (v_batch, 'camp_provision', 'camps', v_mapped_camp, 'reused', NULL,
              v_audit_after || jsonb_build_object('camp_id', v_mapped_camp), v_evidence);
    ELSE
      INSERT INTO data_repair_audit (batch, kind, target_table, target_id, status, before, after, evidence)
      VALUES (v_batch, 'camp_provision', 'camps', v_mapped_camp, 'held', NULL,
              v_audit_after || jsonb_build_object('camp_id', v_mapped_camp,
                'hold_reason', 'existing mapping conflicts with incoming event identity'), v_evidence);
    END IF;
    RETURN;
  END IF;

  -- ---- candidate reuse: full event identity only ----
  SELECT array_agg(c.id) INTO v_candidates
  FROM camps c
  WHERE c.club_name = v_club AND c.county = v_county AND c.name = v_name
    AND c.start_date = v_start AND c.end_date = v_end
    AND c.daily_start_time = v_tstart AND c.daily_end_time = v_tend
    AND c.age_group = v_age;

  IF v_candidates IS NOT NULL AND array_length(v_candidates, 1) > 1 THEN
    INSERT INTO data_repair_audit (batch, kind, target_table, target_id, status, before, after, evidence)
    VALUES (v_batch, 'camp_provision', 'camps', NULL, 'held', NULL,
            v_audit_after || jsonb_build_object('hold_reason', 'ambiguous existing camp candidates',
              'candidate_ids', to_jsonb(v_candidates)), v_evidence);
    RETURN;
  END IF;

  IF v_candidates IS NOT NULL THEN
    v_camp_id := v_candidates[1];
  ELSE
    INSERT INTO camps (name, club_name, venue, county, start_date, end_date,
                       daily_start_time, daily_end_time, age_group, capacity,
                       price_per_child, status, is_auto_created)
    VALUES (v_name, v_club, coalesce(v_venue, ''), v_county, v_start, v_end,
            v_tstart, v_tend, v_age, v_capacity, v_price, 'active', false)
    RETURNING id INTO v_camp_id;
  END IF;

  INSERT INTO source_camp_mappings (source_system, source_camp_id, camp_id, source_camp_label)
  VALUES (v_system, v_source_id, v_camp_id, v_name)
  ON CONFLICT (source_system, source_camp_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    -- Lost a race despite the lock (or a pre-unique-index duplicate): roll back
    -- the whole transaction so a newly created camp is never committed orphaned.
    RAISE EXCEPTION 'mapping insert conflicted for %/% — rolling back', v_system, v_source_id;
  END IF;

  INSERT INTO data_repair_audit (batch, kind, target_table, target_id, status, before, after, evidence)
  VALUES (v_batch, 'camp_provision', 'camps', v_camp_id,
          CASE WHEN v_candidates IS NULL THEN 'applied' ELSE 'reused' END, NULL,
          v_audit_after || jsonb_build_object('camp_id', v_camp_id), v_evidence);
END;
$prov$;
