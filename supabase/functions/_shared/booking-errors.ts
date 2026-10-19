// Converts any thrown value (Error, PostgREST error object, string) into a readable,
// non-sensitive message. Never yields "[object Object]".
export interface BackendErrorInfo { message: string; status: number; code?: string }

export function describeBackendError(err: unknown): BackendErrorInfo {
  const o = (err && typeof err === "object" ? err : null) as Record<string, unknown> | null;
  const code = o && typeof o.code === "string" ? o.code : undefined;
  if (code === "57014") {
    return { status: 503, code, message: "The safety check took too long and was cancelled. Nothing was saved or imported. Please run the preview again." };
  }
  if (code === "55P03" || code === "40P01") {
    return { status: 409, code, message: "Another import or edit was in progress. Nothing was saved or imported. Please run the preview again." };
  }
  let message = "";
  if (typeof err === "string") message = err;
  else if (err instanceof Error) message = err.message;
  else if (o && typeof o.message === "string") message = o.message;
  message = message.trim();
  if (!message || message === "[object Object]") message = "The import service returned an unexpected error. Nothing was imported.";
  return { status: 500, code, message };
}
