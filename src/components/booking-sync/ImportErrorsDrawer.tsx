import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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

/** Fix DD/MM/YYYY → YYYY-MM-DD in date fields of a raw booking object */
function fixDatesInBooking(raw: Record<string, unknown>): Record<string, unknown> {
  const fixed = { ...raw };
  const dateFields = ["date_of_birth", "booking_date", "camp_date"];
  for (const field of dateFields) {
    const val = fixed[field];
    if (val == null || typeof val !== "string") continue;
    const s = String(val).trim();
    // DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      fixed[field] = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
  }
  return fixed;
}

function isDateError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("invalid time value") || lower.includes("invalid date") || lower.includes("date");
}

function isDuplicateError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("duplicate") || lower.includes("unique") || lower.includes("conflict") || lower.includes("already exists");
}

export default function ImportErrorsDrawer({ open, onOpenChange, syncLogId, errorCode, expectedFailedCount, onRefresh }: ImportErrorsDrawerProps) {
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let query = supabase.from("import_errors").select("*").order("created_at", { ascending: false }).limit(200);
    if (syncLogId) query = query.eq("sync_log_id", syncLogId);
    if (errorCode) query = query.eq("error_code", errorCode);
    query.then(({ data }) => {
      setErrors((data as unknown as ImportError[]) || []);
      setLoading(false);
    });
  }, [open, syncLogId, errorCode]);

  const filtered = useMemo(() => {
    if (!search) return errors;
    const q = search.toLowerCase();
    return errors.filter(e =>
      `${e.child_first_name} ${e.child_last_name}`.toLowerCase().includes(q) ||
      e.camp_name?.toLowerCase().includes(q) ||
      e.error_message.toLowerCase().includes(q) ||
      e.error_code?.toLowerCase().includes(q)
    );
  }, [errors, search]);

  const retryBooking = async (rawJson: unknown, fixDates: boolean) => {
    let booking = rawJson as Record<string, unknown>;
    if (fixDates) booking = fixDatesInBooking(booking);
    const { data, error } = await supabase.functions.invoke("booking-intake", {
      body: { bookings: [booking] },
    });
    if (error) throw error;
    return data;
  };

  const handleRetry = async (err: ImportError, fixDates = false) => {
    if (!err.raw_row_json) return;
    setRetrying(err.id);
    try {
      const data = await retryBooking(err.raw_row_json, fixDates);
      const f = data?.summary?.failed || 0;
      toast({
        title: fixDates ? "Fixed dates & retried" : "Retry complete",
        description: `Created: ${data?.summary?.created || 0}, Failed: ${f}`,
      });
      if (f === 0) {
        setErrors(prev => prev.filter(e => e.id !== err.id));
        await supabase.from("import_errors").delete().eq("id", err.id);
      }
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  const handleRetryAll = async () => {
    const rowsWithData = errors.filter(e => e.raw_row_json);
    if (rowsWithData.length === 0) return;
    setRetrying("all");
    let succeeded = 0;
    let failedCount = 0;
    const succeededIds: string[] = [];

    // Process each error with appropriate fix
    for (const err of rowsWithData) {
      try {
        const needsDateFix = isDateError(err.error_message);
        const data = await retryBooking(err.raw_row_json, needsDateFix);
        if ((data?.summary?.failed || 0) === 0) {
          succeeded++;
          succeededIds.push(err.id);
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    // Clean up succeeded error rows
    if (succeededIds.length > 0) {
      for (let i = 0; i < succeededIds.length; i += 50) {
        await supabase.from("import_errors").delete().in("id", succeededIds.slice(i, i + 50));
      }
      setErrors(prev => prev.filter(e => !succeededIds.includes(e.id)));
    }

    toast({
      title: "Retry all complete",
      description: `Succeeded: ${succeeded}, Remaining: ${failedCount}`,
    });
    onRefresh?.();
    setRetrying(null);
  };

  const getRowActions = (err: ImportError) => {
    if (!err.raw_row_json) return null;
    const hasDateErr = isDateError(err.error_message);
    const hasDupErr = isDuplicateError(err.error_message);

    return (
      <div className="flex gap-1">
        {hasDateErr && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleRetry(err, true)}
            disabled={retrying === err.id}
            className="h-7 px-2 text-xs"
            title="Fix DD/MM/YYYY dates and retry"
          >
            <Wrench className={`h-3 w-3 mr-1 ${retrying === err.id ? "animate-spin" : ""}`} />
            Fix dates
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleRetry(err, false)}
          disabled={retrying === err.id}
          className="h-7 px-2 text-xs"
          title={hasDupErr ? "Retry with upsert (should succeed now)" : "Retry this booking"}
        >
          <RotateCcw className={`h-3 w-3 ${retrying === err.id ? "animate-spin" : ""}`} />
        </Button>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
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
            <Input placeholder="Search errors…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
            {errors.filter(e => e.raw_row_json).length > 0 && (
              <Button size="sm" variant="outline" onClick={handleRetryAll} disabled={retrying === "all"}>
                <RotateCcw className={`h-4 w-4 mr-1.5 ${retrying === "all" ? "animate-spin" : ""}`} />
                Retry All ({errors.filter(e => e.raw_row_json).length})
              </Button>
            )}
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading errors…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 space-y-2">
              <AlertCircle className="h-6 w-6 mx-auto opacity-40" />
              {expectedFailedCount && expectedFailedCount > 0 ? (
                <p className="text-sm">No error rows recorded for this sync run ({expectedFailedCount} failures reported).<br />Check booking-intake error logging.</p>
              ) : (
                <p className="text-sm">No errors found</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Child</TableHead>
                    <TableHead>Camp</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(err => (
                    <TableRow key={err.id}>
                      <TableCell className="text-sm font-medium">
                        {err.child_first_name} {err.child_last_name}
                        {err.external_booking_id && (
                          <span className="block text-[10px] text-muted-foreground font-mono">{err.external_booking_id}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{err.camp_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px] mr-1">{err.error_code || "unknown"}</Badge>
                        <span className="text-xs text-muted-foreground">{err.error_message}</span>
                      </TableCell>
                      <TableCell>
                        {getRowActions(err)}
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
