// Client-side contract for booking-import responses. Fail closed: anything that is not a
// complete preview becomes a readable error, which keeps "Confirm import" disabled.
export function readableImportError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim() && payload.trim() !== "[object Object]") return payload.trim();
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if ("error" in p) return readableImportError(p.error, fallback);
    if (typeof p.message === "string") return readableImportError(p.message, fallback);
  }
  return fallback;
}

export function assertPreviewContract<T>(data: unknown): T {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== "object") throw new Error("The preview response was empty. Nothing was imported; please preview again.");
  if ("error" in d) throw new Error(readableImportError(d, "The preview failed. Nothing was imported."));
  const counts = d.counts as Record<string, unknown> | undefined;
  if (typeof d.run_id !== "string" || !/^[0-9a-f-]{36}$/i.test(d.run_id) || !counts || typeof counts !== "object"
    || typeof counts.participants !== "number" || !Array.isArray(d.rows) || !Array.isArray(d.candidates) || typeof d.camp_name !== "string") {
    throw new Error("The preview response was incomplete. Nothing was imported; please preview again.");
  }
  return d as T;
}
