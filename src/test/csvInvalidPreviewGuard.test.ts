// @vitest-environment node
// Isolated synthetic database only; never reads app credentials or real records.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const enabled = process.env.CSV_GUARD_ISOLATED_TEST === "1";
const sql = enabled ? postgres({ host: "/tmp/csv-guard-test", port: 55440, username: "lovable", database: "postgres", max: 1 }) : null;
afterAll(async () => { await sql?.end(); });

describe.skipIf(!enabled)("invalid Parkville preview commit guard (isolated)", () => {
  it("blocks the diagnosed preview, leaves evidence intact, and allows a different fresh run", async () => {
    if (!sql) return;
    const rollback = new Error("SYNTHETIC_ROLLBACK");
    await expect(sql.begin(async (tx) => {
      await tx`create role anon`;
      await tx`create role authenticated`;
      await tx`create table public.booking_import_runs(id uuid primary key,status text,counts jsonb)`;
      await tx.unsafe(readFileSync("drizzle/migrations/0008_block_invalid_parkville_csv_preview.sql", "utf8"));
      const bad = "9b32b6fb-7dcc-4d62-a91f-9f4ca7e85536";
      const fresh = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
      await tx`insert into public.booking_import_runs values(${bad},'preview','{"source_rows":20,"rejected":1}'),(${fresh},'preview','{"source_rows":20,"rejected":0}')`;
      await expect(tx.savepoint(async (t) => {
        await t`update public.booking_import_runs set status='committing' where id=${bad}`;
      })).rejects.toThrow(/fresh preview/);
      const [unchanged] = await tx`select status,counts from public.booking_import_runs where id=${bad}`;
      expect(unchanged).toEqual({ status: "preview", counts: { source_rows: 20, rejected: 1 } });
      await tx`update public.booking_import_runs set status='committing' where id=${fresh}`;
      const [allowed] = await tx`select status from public.booking_import_runs where id=${fresh}`;
      expect(allowed.status).toBe("committing");
      throw rollback;
    })).rejects.toBe(rollback);
    const [clean] = await sql`select to_regclass('public.booking_import_runs') as table_name`;
    expect(clean.table_name).toBeNull();
  });
});