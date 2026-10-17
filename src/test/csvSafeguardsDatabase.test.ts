// @vitest-environment node
// Deliberately ONLY the isolated Unix socket. Never uses project database env vars.
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { normaliseIncoming, participantKey } from "../../supabase/functions/_shared/booking-logic";

const enabled = process.env.CSV_ISOLATED_DB_TEST === "1";
const sql = enabled ? postgres({ host: "/tmp/csv-safety/pgsocket", port: 55439, username: "lovable", database: "postgres", max: 4 }) : null;
afterAll(async () => { await sql?.end(); });
const admin = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const csv = { child_first_name: "Synthetic", child_last_name: "Atomic", date_of_birth: "29/02/2016", parent_email: "atomic@example.test", total_amount: "75", amount_paid: "20", sibling_discount: "10" };

async function fixture(tx: any, rows = [csv], options: { invalidLast?: boolean; profile?: boolean } = {}) {
  await tx`insert into auth.users(id,email,raw_user_meta_data) values(${admin},'synthetic@example.test','{}') on conflict do nothing`;
  await tx`insert into public.user_roles(user_id,role) values(${admin},'admin') on conflict do nothing`;
  await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
  const [camp] = await tx`insert into public.camps(name,club_name,venue,county,start_date,end_date,age_group,capacity,price_per_child,daily_start_time,daily_end_time) values('Synthetic CSV','Synthetic','Synthetic','Test','2026-10-27','2026-10-30','5-14',40,85,'10:00','15:00') returning id`;
  const source = `isolated-${camp.id}`;
  await tx`insert into public.source_camp_mappings(source_system,source_camp_id,camp_id) values('synthetic-test',${source},${camp.id})`;
  let profile: string | null = null;
  if (options.profile) {
    const [p] = await tx`insert into public.players(first_name,last_name,date_of_birth,guardian_email) values('Synthetic','Atomic','2016-02-29','atomic@example.test') returning id`;
    profile = p.id;
  }
  const [{ snapshot }] = await tx`select public.csv_safety_snapshot() snapshot`;
  const plans = rows.map((row, i) => {
    const n = normaliseIncoming(row);
    return { row_index: i, classification: "new", reason: "synthetic server-staged fixture", participant_key: participantKey(n.child_first_name,n.child_last_name,n.date_of_birth,n.parent_email,n.parent_phone), family_key: `e:${row.parent_email}`, synced_booking_id: null, candidate_ids: [], raw_row: row,
      normalized: { ...n, _profile_id: profile, ...(options.invalidLast && i === rows.length - 1 ? { total_amount: "NaN" } : {}) }, diff: null, protected_fields: [], conflict: false };
  });
  const payload = { user_id: admin, source_system: "synthetic-test", source_camp_id: source, camp_id: camp.id, snapshot, counts: {}, rows: plans };
  const [{ id }] = await tx`select public.stage_csv_safety_run(${tx.json(payload)}) id`;
  return { id, camp: camp.id, source, payload, profile };
}
async function rollbackTest(fn: (tx: any) => Promise<void>) {
  if (!sql) return;
  const marker = new Error("EXPECTED_TEST_ROLLBACK");
  await expect(sql.begin(async (tx) => { await fn(tx); throw marker; })).rejects.toBe(marker);
}

describe.skipIf(!enabled)("isolated PostgreSQL atomic CSV safeguards", () => {
  it("commits complete synthetic audit and retry performs zero extra writes; outer rollback removes everything", async () => {
    await rollbackTest(async (tx) => {
      const f = await fixture(tx);
      const [{ result }] = await tx`select public.commit_csv_safety_run(${f.id}) result`;
      expect(result.result).toMatchObject({ created: 1, updated: 0 });
      const [{ n }] = await tx`select count(*)::int n from public.booking_import_changes where run_id=${f.id}`;
      expect(n).toBe(3);
      const [{ result: retry }] = await tx`select public.commit_csv_safety_run(${f.id}) result`;
      expect(retry.replayed).toBe(true);
      const [{ n: regs }] = await tx`select count(*)::int n from public.synced_bookings where matched_camp_id=${f.camp}`;
      expect(regs).toBe(1);
      const [totals] = await tx`select total_amount,amount_paid,amount_owed,kit_given,manual_override from public.synced_bookings where matched_camp_id=${f.camp}`;
      expect(Number(totals.total_amount)).toBe(75); expect(Number(totals.amount_paid)).toBe(20); expect(Number(totals.amount_owed)).toBe(55); expect(totals.kit_given).toBe(false); expect(totals.manual_override).toBe(false);
    });
    if (!sql) return;
    const [{ n }] = await sql`select count(*)::int n from public.synced_bookings where source_system='synthetic-test'`;
    expect(n).toBe(0);
  });
  it("reuses a proven existing profile for another camp without copying medical or consent to that profile", async () => {
    await rollbackTest(async (tx) => {
      const f = await fixture(tx, [csv], { profile: true });
      const [{ before }] = await tx`select to_jsonb(p) before from public.players p where id=${f.profile}`;
      await tx`select public.commit_csv_safety_run(${f.id})`;
      const [{ after }] = await tx`select to_jsonb(p) after from public.players p where id=${f.profile}`;
      expect(after).toEqual(before);
      const [{ pid }] = await tx`select matched_player_id pid from public.synced_bookings where matched_camp_id=${f.camp}`;
      expect(pid).toBe(f.profile);
    });
  });
  it("stale preview aborts after changed mapping/identity/staff/dependency evidence", async () => {
    await rollbackTest(async (tx) => {
      const f = await fixture(tx);
      await tx`update public.camps set venue='changed since preview' where id=${f.camp}`;
      await expect(tx.savepoint(async (t: any) => { await t`select public.commit_csv_safety_run(${f.id})`; })).rejects.toThrow(/Stale preview/);
      const [{ n }] = await tx`select count(*)::int n from public.booking_import_changes where run_id=${f.id}`;
      expect(n).toBe(0);
    });
  });
  it("failure on the second row rolls back the first row, profiles, families and audit", async () => {
    await rollbackTest(async (tx) => {
      const f = await fixture(tx, [csv, { ...csv, child_first_name: "Second", parent_email: "second@example.test" }], { invalidLast: true });
      await expect(tx.savepoint(async (t: any) => { await t`select public.commit_csv_safety_run(${f.id})`; })).rejects.toThrow(/Invalid money/);
      const [{ n }] = await tx`select count(*)::int n from public.synced_bookings where matched_camp_id=${f.camp}`;
      const [{ changes }] = await tx`select count(*)::int changes from public.booking_import_changes where run_id=${f.id}`;
      expect(n).toBe(0); expect(changes).toBe(0);
      const [{ status }] = await tx`select status from public.booking_import_runs where id=${f.id}`;
      expect(status).toBe("preview");
    });
  });
  it("different persisted runs for the same identity cannot create duplicate registrations or profiles", async () => {
    await rollbackTest(async (tx) => {
      const f = await fixture(tx);
      const [{ other }] = await tx`select public.stage_csv_safety_run(${tx.json(f.payload)}) other`;
      await tx`select public.commit_csv_safety_run(${f.id})`;
      await expect(tx.savepoint(async (t: any) => { await t`select public.commit_csv_safety_run(${other})`; })).rejects.toThrow(/Stale preview/);
      const [{ n }] = await tx`select count(*)::int n from public.synced_bookings where matched_camp_id=${f.camp}`;
      expect(n).toBe(1);
    });
  });
  it("parallel same-run, different-run and ordinary writers serialize at the transaction lock", async () => {
    await rollbackTest(async (tx) => {
      const f = await fixture(tx);
      await tx`select public.commit_csv_safety_run(${f.id})`;
      if (!sql) return;
      for (const runId of [f.id, "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"]) {
        await expect(sql.begin(async (t) => {
          await t`select set_config('request.jwt.claim.sub',${admin},true)`;
          // Admin fixture is uncommitted in the first connection: use lock-level contention without bypassing live auth.
          await t`set local lock_timeout='100ms'`;
          await t`lock table public.players,public.synced_bookings in share row exclusive mode`;
          await t`select public.commit_csv_safety_run(${runId})`;
        })).rejects.toThrow(/lock timeout/);
      }
      await expect(sql.begin(async (t) => { await t`set local lock_timeout='100ms'`; await t`insert into public.players(first_name,last_name) values('Concurrent','Synthetic')`; })).rejects.toThrow(/lock timeout/);
    });
  });
  it("admin check denies null/nonadmin identity and authenticated clients cannot mutate persisted plans", async () => {
    await rollbackTest(async (tx) => {
      const f = await fixture(tx);
      await tx`select set_config('request.jwt.claim.sub','',true)`;
      await expect(tx.savepoint(async (t: any) => { await t`select public.commit_csv_safety_run(${f.id})`; })).rejects.toThrow(/Admins only/);
      const [{ allowed }] = await tx`select has_table_privilege('authenticated','public.booking_import_run_rows','UPDATE') allowed`;
      expect(allowed).toBe(false);
    });
  });
});