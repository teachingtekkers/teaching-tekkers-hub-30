import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RotateCcw, AlertCircle, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImportError {
  id: string;
  sync_log_id: string | null;
  external_booking_id: string | null;
  camp_name: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
  error_code: string | null;
  error_message: string;
  raw_row_json: unknown;
  created_at: string;
}

interface ImportErrorsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncLogId?: string | null;
  errorCode?: string | null;
  expectedFailedCount?: number;
  onRefresh?: () => void;
}

function fixDatesInBooking(raw: Record<string, unknown>): Record<string, unknown> {
  const fixed = { ...raw };
  const dateFields = ["date_of_birth", "booking_date", "camp_date"];
  for (const field of dateFields) {
    const value = fixed[field];
    if (typeof value !== "string") continue;
    const match = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) fixed[field] = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  return fixed;
}

function isDateError(message: string) {
  const text = message.toLowerCase();
  return text.includes("invalid time value") || text.includes("invalid date");
}

function isMaterializeError(code: string | null) {
  return code === "materialize_players";
}

export default function ImportErrorsDrawer({ open, onOpenChange, syncLogId, errorCode, expectedFailedCount, onRefresh }: ImportErrorsDrawerProps) {
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);
  const { toast } = useToast();

  const loadErrors = async () => {
    setLoading(true);
    let query = supabase.from("import_errors").select("*").order("created_at", { ascending: false }).limit(500);
    if (syncLogId) query = query.eq("sync_log_id", syncLogId);
    if (errorCode) query = query.eq("error_code", errorCode);
    const { data } = await query;
    setErrors((data as ImportError[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    loadErrors();
  }, [open, syncLogId, errorCode]);

  const filtered = useMemo(() => {
    if (!search) return errors;
    const q = search.toLowerCase();
    return errors.filter((e) =>
      `${e.child_first_name} ${e.child_last_name}`.toLowerCase().includes(q) ||
      e.camp_name?.toLowerCase().includes(q) ||
      e.error_message.toLowerCase().includes(q) ||
      e.error_code?.toLowerCase().includes(q),
    );
  }, [errors, search]);

  const retryRow = async (err: ImportError, applyDateFix = false) => {
    if (!err.raw_row_json) return;
    const raw = (applyDateFix ? fixDatesInBooking(err.raw_row_json as Record<string, unknown>) : err.raw_row_json) as Record<string, unknown>;

    if (isMaterializeError(err.error_code)) {
      const bookingId = typeof raw.id === "string" ? raw.id : null;
      const externalBookingId = typeof raw.external_booking_id === "string" ? raw.external_booking_id : err.external_booking_id;
      const { data, error } = await supabase.functions.invoke("materialize-players", {
        body: {
          bookingIds: bookingId ? [bookingId] : undefined,
          externalBookingIds: !bookingId && externalBookingId ? [externalBookingId] : undefined,
        },
      });
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase.functions.invoke("booking-intake", {
      body: { bookings: [raw] },
    });
    if (error) throw error;
    return data;
  };

  const handleRetry = async (err: ImportError, applyDateFix = false) => {
    setRetrying(err.id);
    try {
      const data = await retryRow(err, applyDateFix);
      const failed = data?.failed ?? data?.summary?.failed ?? 0;
      if (failed === 0) {
        await supabase.from("import_errors").delete().eq("id", err.id);
        setErrors((prev) => prev.filter((item) => item.id !== err.id));
      }
      toast({
        title: applyDateFix ? "Fixed and retried" : "Retry complete",
        description: isMaterializeError(err.error_code)
          ? `Linked: ${data?.linked_players || 0}, Failed: ${failed}`
          : `Created: ${data?.summary?.created || 0}, Failed: ${failed}`,
      });
      onRefresh?.();
    } catch (e) {
      toast({ title: "Retry failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  const handleRetryAll = async () => {
    const retryable = errors.filter((err) => err.raw_row_json);
    if (!retryable.length) return;
    setRetrying("all");
    let succeeded = 0;
    let remaining = 0;
    const solvedIds: string[] = [];

    for (const err of retryable) {
      try {
        const data = await retryRow(err, isDateError(err.error_message));
        const failed = data?.failed ?? data?.summary?.failed ?? 0;
        if (failed === 0) {
          succeeded += 1;
          solvedIds.push(err.id);
        } else {
          remaining += 1;
        }
      } catch {
        remaining += 1;
      }
    }

    if (solvedIds.length) {
      for (let i = 0; i < solvedIds.length; i += 100) {
        await supabase.from("import_errors").delete().in("id", solvedIds.slice(i, i + 100));
      }
      setErrors((prev) => prev.filter((err) => !solvedIds.includes(err.id)));
    }

    toast({ title: "Retry all complete", description: `Succeeded: ${succeeded}, Remaining: ${remaining}` });
    onRefresh?.();
    setRetrying(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Import Errors ({errors.length})
          </SheetTitle>
          <SheetDescription>
            {syncLogId ? "Errors from this sync run" : errorCode ? `Errors with code: ${errorCode}` : "All import errors"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search errors…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
            {errors.some((e) => e.raw_row_json) && (
              <Button size="sm" variant="outline" onClick={handleRetryAll} disabled={retrying === "all"}>
                <RotateCcw className={`mr-1.5 h-4 w-4 ${retrying === "all" ? "animate-spin" : ""}`} />
                Retry All ({errors.filter((e) => e.raw_row_json).length})
              </Button>
            )}
          </div>

          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Loading errors…</p>
          ) : filtered.length === 0 ? (
            <div className="space-y-2 py-8 text-center text-muted-foreground">
              <AlertCircle className="mx-auto h-6 w-6 opacity-40" />
              {expectedFailedCount && expectedFailedCount > 0 ? (
                <p className="text-sm">No error rows recorded for this sync run ({expectedFailedCount} failures reported).<br />Check booking-intake error logging.</p>
              ) : (
                <p className="text-sm">No errors found</p>
              )}
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Child</TableHead>
                    <TableHead>Camp</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-32">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((err) => (
                    <TableRow key={err.id}>
                      <TableCell className="text-sm font-medium">
                        {err.child_first_name} {err.child_last_name}
                        {err.external_booking_id && <span className="block font-mono text-[10px] text-muted-foreground">{err.external_booking_id}</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{err.camp_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="mr-1 text-[10px]">{err.error_code || "unknown"}</Badge>
                        <span className="text-xs text-muted-foreground">{err.error_message}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isDateError(err.error_message) && !isMaterializeError(err.error_code) && (
                            <Button size="sm" variant="ghost" onClick={() => handleRetry(err, true)} disabled={retrying === err.id} className="h-7 px-2 text-xs">
                              <Wrench className={`mr-1 h-3 w-3 ${retrying === err.id ? "animate-spin" : ""}`} />
                              Fix dates
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleRetry(err, false)} disabled={retrying === err.id} className="h-7 px-2 text-xs">
                            <RotateCcw className={`h-3 w-3 ${retrying === err.id ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}