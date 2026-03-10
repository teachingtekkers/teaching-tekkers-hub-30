import { useState, useCallback, useRef, useMemo, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, X, Files } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedRow {
  [key: string]: string;
}

interface ParsedFile {
  name: string;
  headers: string[];
  rows: ParsedRow[];
  campNames: string[];
  detectedCampName: string;
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
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ""; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseRow(line);
    const obj: ParsedRow = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
  return { headers, rows };
}

function detectCampNames(rows: ParsedRow[], headers: string[]): string[] {
  const campCol = headers.find((h) => autoMapColumn(h) === "camp_name");
  if (!campCol) return [];
  const names = new Set<string>();
  rows.forEach((r) => { if (r[campCol]) names.add(r[campCol]); });
  return Array.from(names);
}

// Extract camp name from filename like:
// "TeachingTekkers -Easter Camps (...)-Dublin-Portmarnock AFC-Portmarnock AFC Easter Camp 2026 WK1.csv"
// Strategy: take the last segment after the final hyphen, strip extension
function extractCampNameFromFilename(filename: string): string {
  // Remove extension
  const noExt = filename.replace(/\.(csv|tsv|txt)$/i, "").trim();

  // Split by " - " or "-" (with surrounding spaces preferred)
  const segments = noExt.split(/\s*[-–]\s*/);

  // Take the last segment — this is typically the camp name
  let campName = segments[segments.length - 1]?.trim() || noExt;

  // If last segment is very short (< 5 chars), try second-to-last
  if (campName.length < 5 && segments.length > 1) {
    campName = segments[segments.length - 2]?.trim() || campName;
  }

  // Clean up: remove parenthetical content like "(additional online charge...)"
  campName = campName.replace(/\([^)]*\)/g, "").trim();

  return campName || noExt;
}

interface BookingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export default function BookingImportDialog({ open, onOpenChange, onImportComplete }: BookingImportDialogProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Merged unique headers across all files
  const allHeaders = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => f.headers.forEach((h) => set.add(h)));
    return Array.from(set);
  }, [files]);

  const totalRows = useMemo(() => files.reduce((s, f) => s + f.rows.length, 0), [files]);
  const allCampNames = useMemo(() => {
    return files.map((f) => f.detectedCampName).filter(Boolean);
  }, [files]);

  const reset = useCallback(() => {
    setStep("upload");
    setFiles([]);
    setMapping({});
    setResult(null);
    setDragOver(false);
  }, []);

  const processFiles = useCallback((fileList: File[]) => {
    const validFiles = fileList.filter((f) =>
      f.name.match(/\.(csv|tsv|txt)$/i)
    );
    if (validFiles.length === 0) {
      toast({ title: "No valid files", description: "Please select CSV, TSV, or TXT files.", variant: "destructive" });
      return;
    }

    let loaded = 0;
    const parsed: ParsedFile[] = [...files];

    validFiles.forEach((file) => {
      // Skip if already added
      if (parsed.some((p) => p.name === file.name)) { loaded++; return; }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSV(text);
        if (headers.length > 0 && rows.length > 0) {
          const detectedCampName = extractCampNameFromFilename(file.name);
          const hasCampCol = headers.some((h) => autoMapColumn(h) === "camp_name");
          parsed.push({
            name: file.name,
            headers,
            rows,
            campNames: hasCampCol ? detectCampNames(rows, headers) : [detectedCampName],
            detectedCampName,
          });
        }
        loaded++;
        if (loaded === validFiles.length) {
          setFiles([...parsed]);
          // Auto-map from merged headers
          const mergedHeaders = new Set<string>();
          parsed.forEach((p) => p.headers.forEach((h) => mergedHeaders.add(h)));
          const autoMap: Record<string, string> = {};
          mergedHeaders.forEach((h) => { autoMap[h] = autoMapColumn(h); });
          setMapping((prev) => ({ ...autoMap, ...prev }));
          if (parsed.length > 0) setStep("map");
        }
      };
      reader.readAsText(file);
    });
  }, [files, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    processFiles(Array.from(e.target.files));
    e.target.value = "";
  }, [processFiles]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const removeFile = useCallback((name: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.name !== name);
      if (next.length === 0) setStep("upload");
      return next;
    });
  }, []);

  const mappedFields = Object.values(mapping).filter((v) => v !== "skip");
  // Camp name is auto-detected from filename, so only child names are truly required from columns
  const hasRequired = ["child_first_name", "child_last_name"].every((f) => mappedFields.includes(f));

  const getMappedRows = useCallback(() => {
    const allMapped: Record<string, string>[] = [];
    files.forEach((f) => {
      const hasCampCol = f.headers.some((h) => mapping[h] === "camp_name");
      f.rows.forEach((row) => {
        const mapped: Record<string, string> = {};
        for (const [csvCol, field] of Object.entries(mapping)) {
          if (field !== "skip" && row[csvCol]) mapped[field] = row[csvCol];
        }
        // If no camp_name column mapped, inject from filename
        if (!hasCampCol || !mapped.camp_name) {
          mapped.camp_name = f.detectedCampName;
        }
        allMapped.push(mapped);
      });
    });
    return allMapped.filter((r) => r.child_first_name && r.child_last_name && r.camp_name);
  }, [files, mapping]);

  const handleImport = useCallback(async () => {
    setStep("importing");
    const bookings = getMappedRows();
    try {
      const { data, error } = await supabase.functions.invoke("booking-intake", {
        body: { bookings },
      });
      if (error) throw error;
      setResult({ ...(data.summary as ImportResult) });
      setStep("done");
      toast({
        title: "Batch import complete",
        description: `${files.length} file(s) — ${data.summary.created} created, ${data.summary.updated} updated, ${data.summary.failed} failed`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Import failed", description: message, variant: "destructive" });
      setStep("preview");
    }
  }, [getMappedRows, toast, files.length]);

  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      if (step === "done") onImportComplete();
      reset();
    }
    onOpenChange(isOpen);
  }, [step, onImportComplete, onOpenChange, reset]);

  // First row sample for mapping display
  const sampleRow = useMemo(() => {
    for (const f of files) { if (f.rows[0]) return f.rows[0]; }
    return {} as ParsedRow;
  }, [files]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Booking Files
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload one or more CSV files exported from your booking system. You can import multiple camp files in one batch.
            </p>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-accent/50" : "hover:border-primary/50 hover:bg-accent/30"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">
                {dragOver ? "Drop files here" : "Drag & drop files or click to select"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TSV, or TXT • Multiple files supported</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "map" && (
          <div className="space-y-4">
            {/* File list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Files className="h-4 w-4" />
                  {files.length} file{files.length > 1 ? "s" : ""} • {totalRows} total rows
                </p>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1.5" /> Add More
                </Button>
              </div>
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.name} className="flex items-center gap-3 rounded-md border bg-accent/30 px-3 py-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{f.name}</p>
                      <p className="text-sm font-medium text-foreground">{f.detectedCampName}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{f.rows.length} rows</Badge>
                    <button onClick={() => removeFile(f.name)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Column mapping */}
            <div className="grid gap-2 max-h-[350px] overflow-y-auto">
              {allHeaders.map((h) => (
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
                  <span className="text-xs text-muted-foreground truncate">{sampleRow[h] || ""}</span>
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
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" multiple className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{getMappedRows().length}</span> valid rows from{" "}
                <span className="font-medium text-foreground">{files.length}</span> file{files.length > 1 ? "s" : ""} ready to import.
              </p>
              {allCampNames.length > 0 && (
                <Badge variant="outline">{allCampNames.length} camp{allCampNames.length > 1 ? "s" : ""}</Badge>
              )}
            </div>
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
                  {getMappedRows().slice(0, 100).map((r, i) => (
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
            {getMappedRows().length > 100 && (
              <p className="text-xs text-muted-foreground">Showing first 100 of {getMappedRows().length} rows</p>
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
            <p className="font-medium">Importing {files.length} file{files.length > 1 ? "s" : ""}…</p>
            <p className="text-sm text-muted-foreground">Matching camps, checking duplicates, creating records</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="py-6 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-600" />
              <p className="text-lg font-semibold">Batch Import Complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {files.length} file{files.length > 1 ? "s" : ""} processed
              </p>
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
            {/* Per-file breakdown */}
            <div className="space-y-1">
              {files.map((f) => (
                <div key={f.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>{f.name}</span>
                  <span>— {f.rows.length} rows</span>
                  {f.campNames.length > 0 && <span>({f.campNames.join(", ")})</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
