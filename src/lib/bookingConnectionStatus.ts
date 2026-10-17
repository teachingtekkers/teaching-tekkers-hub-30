export interface CsvImport {
  id: string;
  committed_at: string | null;
}

/** Only completed manual imports count as CSV activity; never legacy sync logs. */
export function latestCsvImportQuery(db: { from: (table: string) => any }) {
  return db.from("booking_import_runs").select("id,committed_at")
    .eq("trigger", "manual").eq("status", "committed")
    .neq("source_system", "synthetic-test").not("committed_at", "is", null)
    .order("committed_at", { ascending: false }).limit(1).maybeSingle();
}

export function connectionStatus(importRun: CsvImport | null, loading = false, error = false) {
  return {
    provider: "disconnected" as const,
    schedulerHealth: "unverified" as const,
    history: loading ? "loading" : error ? "unavailable" : importRun?.committed_at ? "completed" : "none",
    committedAt: !loading && !error ? importRun?.committed_at ?? null : null,
  };
}