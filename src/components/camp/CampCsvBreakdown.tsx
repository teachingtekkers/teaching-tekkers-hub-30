import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface Row {
  id: string;
  child_first_name: string;
  child_last_name: string;
  date_of_birth: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  payment_status: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  amount_owed: number | null;
  booking_date: string | null;
  imported_at: string;
  camp_name: string;
  camp_date: string | null;
}

interface Props {
  campId: string | null;
  campName?: string;
  onClose: () => void;
}

const normKey = (r: Row) =>
  `${r.child_first_name.trim().toLowerCase()}|${r.child_last_name.trim().toLowerCase()}|${r.date_of_birth || ""}`;

export const CampCsvBreakdown = ({ campId, campName, onClose }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campId) return;
    setLoading(true);
    (async () => {
      const all: Row[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("synced_bookings")
          .select("id, child_first_name, child_last_name, date_of_birth, parent_name, parent_email, parent_phone, payment_status, total_amount, amount_paid, amount_owed, booking_date, imported_at, camp_name, camp_date")
          .eq("matched_camp_id", campId)
          .order("child_last_name", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        all.push(...(data as Row[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setRows(all);
      setLoading(false);
    })();
  }, [campId]);

  // Duplicate detection
  const counts = new Map<string, number>();
  rows.forEach(r => counts.set(normKey(r), (counts.get(normKey(r)) || 0) + 1));
  const uniqueKids = counts.size;
  const duplicates = rows.length - uniqueKids;

  return (
    <Dialog open={!!campId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>CSV Rows — {campName}</DialogTitle>
          <DialogDescription className="flex gap-3 items-center pt-1">
            <span><strong>{rows.length}</strong> rows imported</span>
            <span>·</span>
            <span><strong>{uniqueKids}</strong> unique children</span>
            {duplicates > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {duplicates} duplicate{duplicates > 1 ? "s" : ""}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto flex-1">
          {loading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No CSV rows linked to this camp.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Email / Phone</TableHead>
                  <TableHead>CSV Camp Name</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const isDup = (counts.get(normKey(r)) || 0) > 1;
                  return (
                    <TableRow key={r.id} className={isDup ? "bg-destructive/5" : ""}>
                      <TableCell className="text-sm font-medium">{r.child_first_name} {r.child_last_name}</TableCell>
                      <TableCell className="text-xs">{r.date_of_birth || "—"}</TableCell>
                      <TableCell className="text-xs">{r.parent_name || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.parent_email || "—"}</div>
                        <div className="text-muted-foreground">{r.parent_phone || ""}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.camp_name}{r.camp_date ? ` (${r.camp_date})` : ""}</TableCell>
                      <TableCell className="text-xs">{r.booking_date || r.imported_at.slice(0,10)}</TableCell>
                      <TableCell className="text-right text-xs">€{Number(r.total_amount || 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-xs">€{Number(r.amount_paid || 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right text-xs">€{Number(r.amount_owed || 0).toFixed(0)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.payment_status || "—"}</Badge></TableCell>
                      <TableCell>{isDup && <Badge variant="destructive" className="text-[10px]">Dup</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};