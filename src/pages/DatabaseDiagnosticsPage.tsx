import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface Counts {
  total: number;
  totalAmountGt0: number;
  amountPaidGt0: number;
  amountOwedGt0: number;
  statusPaid: number;
  statusPending: number;
  statusPartial: number;
  statusRefunded: number;
  statusNull: number;
  statusOther: number;
}

export default function DatabaseDiagnosticsPage() {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [sampleStatuses, setSampleStatuses] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);

    // 1) Columns via RPC raw SQL isn't available, so we use a workaround:
    // Query a single row to get column names, plus we know the schema
    const { data: colData } = await supabase.rpc("get_synced_bookings_columns" as any);
    if (colData) {
      setColumns(colData as any);
    } else {
      // Fallback: derive from a sample row
      const { data: sample } = await supabase.from("synced_bookings").select("*").limit(1);
      if (sample && sample[0]) {
        setColumns(Object.keys(sample[0]).map(k => ({
          column_name: k,
          data_type: typeof sample[0][k] === "number" ? "numeric" : typeof sample[0][k] === "boolean" ? "boolean" : "text",
          is_nullable: "unknown",
          column_default: null,
        })));
      }
    }

    // 2) Counts
    const [
      { count: total },
      { count: totalAmountGt0 },
      { count: amountPaidGt0 },
      { count: amountOwedGt0 },
      { count: statusPaid },
      { count: statusPending },
      { count: statusPartial },
      { count: statusRefunded },
      { count: statusNull },
    ] = await Promise.all([
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).gt("total_amount", 0),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).gt("amount_paid", 0),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).gt("amount_owed", 0),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).eq("payment_status", "paid"),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).eq("payment_status", "partial"),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).eq("payment_status", "refunded"),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).is("payment_status", null),
    ]);

    setCounts({
      total: total ?? 0,
      totalAmountGt0: totalAmountGt0 ?? 0,
      amountPaidGt0: amountPaidGt0 ?? 0,
      amountOwedGt0: amountOwedGt0 ?? 0,
      statusPaid: statusPaid ?? 0,
      statusPending: statusPending ?? 0,
      statusPartial: statusPartial ?? 0,
      statusRefunded: statusRefunded ?? 0,
      statusNull: statusNull ?? 0,
      statusOther: (total ?? 0) - (statusPaid ?? 0) - (statusPending ?? 0) - (statusPartial ?? 0) - (statusRefunded ?? 0) - (statusNull ?? 0),
    });

    // Sample distinct statuses
    const { data: statusSample } = await supabase
      .from("synced_bookings")
      .select("payment_status")
      .limit(200);
    if (statusSample) {
      const unique = [...new Set(statusSample.map(r => r.payment_status ?? "(null)"))];
      setSampleStatuses(unique);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Database Diagnostics</h1>
        <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Counts Summary */}
      {counts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Row Counts</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Total rows: <strong>{counts.total}</strong></p>
              <p>total_amount &gt; 0: <strong>{counts.totalAmountGt0}</strong></p>
              <p>amount_paid &gt; 0: <strong>{counts.amountPaidGt0}</strong></p>
              <p>amount_owed &gt; 0: <strong>{counts.amountOwedGt0}</strong></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Payment Status Distribution</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>paid: <strong>{counts.statusPaid}</strong></p>
              <p>pending: <strong>{counts.statusPending}</strong></p>
              <p>partial: <strong>{counts.statusPartial}</strong></p>
              <p>refunded: <strong>{counts.statusRefunded}</strong></p>
              <p>null: <strong>{counts.statusNull}</strong></p>
              {counts.statusOther > 0 && <p>other: <strong>{counts.statusOther}</strong></p>}
              <p className="pt-2 text-muted-foreground">Distinct values: {sampleStatuses.join(", ")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Columns Table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">synced_bookings columns</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map(c => (
                <TableRow key={c.column_name}>
                  <TableCell className="font-mono text-xs">{c.column_name}</TableCell>
                  <TableCell className="text-xs">{c.data_type}</TableCell>
                  <TableCell className="text-xs">{c.is_nullable}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.column_default ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
