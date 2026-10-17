import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CsvImportTime from "@/components/booking-sync/CsvImportTime";
import { connectionStatus, latestCsvImportQuery } from "@/lib/bookingConnectionStatus";

const completed = { id: "synthetic-run", committed_at: "2026-10-16T19:21:48.814Z" };

describe("booking connection truthfulness", () => {
  it("no completed import has no timestamp and does not indicate a connection", () => {
    expect(connectionStatus(null)).toEqual({ provider: "disconnected", schedulerHealth: "unverified", history: "none", committedAt: null });
    expect(() => renderToStaticMarkup(<CsvImportTime run={null} />)).not.toThrow();
  });
  it("completed CSV activity preserves the actual commit timestamp, not provider connectivity", () => {
    expect(connectionStatus(completed)).toEqual({ provider: "disconnected", schedulerHealth: "unverified", history: "completed", committedAt: "2026-10-16T19:21:48.814Z" });
    expect(() => renderToStaticMarkup(<CsvImportTime run={completed} />)).not.toThrow();
  });
  it("failed history reads do not report no import or a stale timestamp", () => {
    expect(connectionStatus(completed, false, true).history).toBe("unavailable");
    expect(connectionStatus(completed, false, true).committedAt).toBeNull();
    expect(connectionStatus(completed, true).history).toBe("loading");
    expect(() => renderToStaticMarkup(<CsvImportTime run={completed} error />)).not.toThrow();
  });
  it("queries only latest committed manual CSV history, excluding previews, auto intake and legacy logs", async () => {
    const calls: unknown[][] = [];
    const query = {
      select: (...args: unknown[]) => { calls.push(["select", ...args]); return query; },
      eq: (...args: unknown[]) => { calls.push(["eq", ...args]); return query; },
      neq: (...args: unknown[]) => { calls.push(["neq", ...args]); return query; },
      not: (...args: unknown[]) => { calls.push(["not", ...args]); return query; },
      order: (...args: unknown[]) => { calls.push(["order", ...args]); return query; },
      limit: (...args: unknown[]) => { calls.push(["limit", ...args]); return query; },
      maybeSingle: () => Promise.resolve({ data: completed, error: null }),
    };
    const result = await latestCsvImportQuery({ from: (table) => { calls.push(["from", table]); return query; } });
    expect(calls).toEqual([
      ["from", "booking_import_runs"], ["select", "id,committed_at"],
      ["eq", "trigger", "manual"], ["eq", "status", "committed"],
      ["neq", "source_system", "synthetic-test"], ["not", "committed_at", "is", null],
      ["order", "committed_at", { ascending: false }], ["limit", 1],
    ]);
    expect(result.data.committed_at).toBe(completed.committed_at);
  });
});