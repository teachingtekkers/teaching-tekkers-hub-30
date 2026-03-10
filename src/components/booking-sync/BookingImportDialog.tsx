import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  camps_created?: number;
}

const BOOKING_FIELDS = [
  { key: "external_booking_id", label: "Booking ID" },
  { key: "camp_name", label: "Camp Name", required: true },
  { key: "camp_date", label: "Camp Date" },
  { key: "venue", label: "Venue" },
  { key: "county", label: "County" },
  { key: "child_first_name", label: "Child First Name", required: true },
  { key: "child_last_name", label: "Child Last Name", required: true },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "age", label: "Age" },
  { key: "parent_name", label: "Parent Name" },
  { key: "parent_phone", label: "Parent Phone" },
  { key: "parent_email", label: "Parent Email" },
  { key: "emergency_contact", label: "Emergency Contact" },
  { key: "medical_notes", label: "Medical Notes" },
  { key: "kit_size", label: "Kit Size" },
  { key: "payment_status", label: "Payment Status" },
  { key: "booking_status", label: "Booking Status" },
];

// Common aliases for auto-mapping
const ALIASES: Record<string, string[]> = {
  external_booking_id: ["booking id", "booking_id", "order id", "order_id", "id", "ref", "reference"],
  camp_name: ["camp", "camp name", "camp_name", "event", "event name"],
  camp_date: ["date", "camp date", "camp_date", "event date", "start date"],
  venue: ["venue", "location", "venue name", "ground", "pitch"],
  county: ["county", "area", "region"],
  child_first_name: ["first name", "first_name", "child first name", "child_first_name", "forename", "child first"],
  child_last_name: ["last name", "last_name", "surname", "child last name", "child_last_name", "child last", "family name"],
  date_of_birth: ["dob", "date of birth", "date_of_birth", "birthday", "birth date"],
  age: ["age", "child age"],
  parent_name: ["parent", "parent name", "parent_name", "guardian", "guardian name"],
  parent_phone: ["phone", "parent phone", "parent_phone", "mobile", "contact number", "tel"],
  parent_email: ["email", "parent email", "parent_email", "contact email"],
  emergency_contact: ["emergency", "emergency contact", "emergency_contact", "emergency phone"],
  medical_notes: ["medical", "medical notes", "medical_notes", "health", "allergies", "conditions"],
  kit_size: ["kit", "kit size", "kit_size", "jersey size", "size", "t-shirt size"],
  payment_status: ["payment", "payment status", "payment_status", "paid", "payment state"],
  booking_status: ["status", "booking status", "booking_status", "state"],
};

function autoMapColumn(header: string): string {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(h) || h === field) return field;
  }
  return "skip";
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseRow(line);
    const obj: ParsedRow = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] || "";
    });
    return obj;
  });

  return { headers, rows };
}

interface BookingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export default function BookingImportDialog({ open, onOpenChange, onImportComplete }: BookingImportDialogProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setFileName("");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0 || r.length === 0) {
        toast({ title: "Empty file", description: "No data rows found in the file.", variant: "destructive" });
        return;
      }
      setHeaders(h);
      setRows(r);
      // Auto-map columns
      const autoMap: Record<string, string> = {};
      h.forEach((header) => {
        autoMap[header] = autoMapColumn(header);
      });
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  }, [toast]);

  const mappedFields = Object.values(mapping).filter((v) => v !== "skip");
  const hasRequired = BOOKING_FIELDS.filter((f) => f.required).every((f) => mappedFields.includes(f.key));

  const getMappedRows = useCallback(() => {
    return rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field !== "skip" && row[csvCol]) {
          mapped[field] = row[csvCol];
        }
      }
      return mapped;
    }).filter((r) => r.child_first_name && r.child_last_name && r.camp_name);
  }, [rows, mapping]);

  const handleImport = useCallback(async () => {
    setStep("importing");
    const bookings = getMappedRows();

    try {
      const { data, error } = await supabase.functions.invoke("booking-intake", {
        body: { bookings },
      });

      if (error) throw error;

      setResult(data.summary as ImportResult);
      setStep("done");
      toast({
        title: "Import complete",
        description: `${data.summary.created} created, ${data.summary.updated} updated, ${data.summary.failed} failed`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Import failed", description: message, variant: "destructive" });
      setStep("preview");
    }
  }, [getMappedRows, toast]);

  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      if (step === "done") onImportComplete();
      reset();
    }
    onOpenChange(isOpen);
  }, [step, onImportComplete, onOpenChange, reset]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Booking File
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or tab-separated file exported from your booking system. The system will auto-detect columns.
            </p>
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">Click to select a file</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TSV, or TXT • Max 5,000 rows</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{fileName}</span> — {rows.length} rows found. Map columns below.
              </p>
              <Badge variant="secondary">{mappedFields.length} mapped</Badge>
            </div>

            <div className="grid gap-2 max-h-[400px] overflow-y-auto">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3 py-1">
                  <span className="text-sm font-mono w-48 truncate shrink-0" title={h}>{h}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Select value={mapping[h] || "skip"} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">— Skip —</SelectItem>
                      {BOOKING_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label} {f.required ? "*" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground truncate">{rows[0]?.[h] || ""}</span>
                </div>
              ))}
            </div>

            {!hasRequired && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Required fields: Camp Name, Child First Name, Child Last Name
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button disabled={!hasRequired} onClick={() => setStep("preview")}>
                Preview {getMappedRows().length} Rows
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview of <span className="font-medium text-foreground">{getMappedRows().length}</span> valid rows ready to import.
            </p>
            <div className="rounded-lg border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Child</TableHead>
                    <TableHead>Camp</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedRows().slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{r.child_first_name} {r.child_last_name}</TableCell>
                      <TableCell className="text-sm">{r.camp_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.parent_name || "—"}</TableCell>
                      <TableCell className="text-sm">{r.payment_status || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {getMappedRows().length > 50 && (
              <p className="text-xs text-muted-foreground">Showing first 50 of {getMappedRows().length} rows</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-1.5" /> Import {getMappedRows().length} Bookings
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="font-medium">Importing bookings…</p>
            <p className="text-sm text-muted-foreground">Matching camps, checking duplicates, creating records</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="py-6 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-600" />
              <p className="text-lg font-semibold">Import Complete</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.processed}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${result.failed > 0 ? "text-destructive" : "text-foreground"}`}>{result.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            {(result.camps_created || 0) > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {result.camps_created} new camp(s) auto-created from booking data
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
