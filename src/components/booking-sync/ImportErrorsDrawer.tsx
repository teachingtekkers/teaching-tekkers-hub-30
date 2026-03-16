import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RotateCcw, AlertCircle } from "lucide-react";
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

export default function ImportErrorsDrawer({ open, onOpenChange, syncLogId, errorCode, onRefresh }: ImportErrorsDrawerProps) {
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

  const handleRetry = async (err: ImportError) => {
    if (!err.raw_row_json) return;
    setRetrying(err.id);
    try {
      const { data, error } = await supabase.functions.invoke("booking-intake", {
        body: { bookings: [err.raw_row_json] },
      });
      if (error) throw error;
      toast({
        title: "Retry complete",
        description: `Created: ${data?.summary?.created || 0}, Updated: ${data?.summary?.updated || 0}, Failed: ${data?.summary?.failed || 0}`,
      });
      // Remove from list on success
      if (data?.summary?.failed === 0) {
        setErrors(prev => prev.filter(e => e.id !== err.id));
        // Delete the error row
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
    try {
      const { data, error } = await supabase.functions.invoke("booking-intake", {
        body: { bookings: rowsWithData.map(e => e.raw_row_json) },
      });
      if (error) throw error;
      toast({
        title: "Retry all complete",
        description: `Created: ${data?.summary?.created || 0}, Updated: ${data?.summary?.updated || 0}, Failed: ${data?.summary?.failed || 0}`,
      });
      // Clear successfully retried errors
      if (data?.summary?.failed === 0) {
        const ids = rowsWithData.map(e => e.id);
        for (let i = 0; i < ids.length; i += 50) {
          await supabase.from("import_errors").delete().in("id", ids.slice(i, i + 50));
        }
        setErrors(prev => prev.filter(e => !ids.includes(e.id)));
      }
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Retry all failed", description: e.message, variant: "destructive" });
    } finally {
      setRetrying(null);
    }
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
            <p className="text-center text-muted-foreground py-8">No errors found</p>
          ) : (
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Child</TableHead>
                    <TableHead>Camp</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-20">Action</TableHead>
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
                        {err.raw_row_json && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRetry(err)}
                            disabled={retrying === err.id}
                            className="h-7 px-2"
                          >
                            <RotateCcw className={`h-3 w-3 ${retrying === err.id ? "animate-spin" : ""}`} />
                          </Button>
                        )}
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
