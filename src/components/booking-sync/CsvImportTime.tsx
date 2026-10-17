import { format } from "date-fns";
import { connectionStatus, type CsvImport } from "@/lib/bookingConnectionStatus";

export default function CsvImportTime({ run, loading = false, error = false }: {
  run: CsvImport | null; loading?: boolean; error?: boolean;
}) {
  const state = connectionStatus(run, loading, error);
  if (state.history === "loading") return <>Loading…</>;
  if (state.history === "unavailable") return <>Import history unavailable</>;
  if (!state.committedAt) return <>No completed CSV imports</>;
  return <time dateTime={state.committedAt}>{format(new Date(state.committedAt), "dd MMM yyyy HH:mm")}</time>;
}