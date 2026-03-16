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
  detectedVenue: string | null;
  detectedCounty: string | null;
}

interface ImportResult {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  camps_created?: number;
}

const BOOKING_FIELDS = [
  { key: "child_first_name", label: "Child First Name", required: true },
  { key: "child_last_name", label: "Child Last Name", required: true },
  { key: "parent_name", label: "Parent Name" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "age", label: "Age" },
  { key: "parent_email", label: "Parent Email" },
  { key: "parent_phone", label: "Contact No" },
  { key: "emergency_contact", label: "Emergency Contact" },
  { key: "alternate_phone", label: "Alternate No" },
  { key: "medical_condition", label: "Medical Condition" },
  { key: "medical_notes", label: "Medical Additional Info" },
  { key: "photo_permission", label: "Photo Permission" },
  { key: "booking_date", label: "Booking Date" },
  { key: "total_amount", label: "Total Amount" },
  { key: "sibling_discount", label: "Siblings Discount" },
  { key: "amount_paid", label: "Amount Paid" },
  { key: "payment_status", label: "Payment Status" },
  { key: "payment_type", label: "Payment Type" },
  { key: "refund_amount", label: "Refund Amount" },
  { key: "external_booking_id", label: "Booking ID" },
  { key: "camp_name", label: "Camp Name" },
  { key: "camp_date", label: "Camp Date" },
  { key: "venue", label: "Venue" },
  { key: "county", label: "County" },
  { key: "kit_size", label: "Kit Size" },
  { key: "booking_status", label: "Booking Status" },
  { key: "amount_owed", label: "Amount Owed" },
];

// Exact Teaching Tekkers CSV column aliases — prioritised
const ALIASES: Record<string, string[]> = {
  external_booking_id: ["sr. no", "sr no", "booking id", "booking_id", "order id", "id", "ref", "reference"],
  child_first_name: ["first name", "first_name", "child first name", "child_first_name", "forename"],
  child_last_name: ["last name", "last_name", "surname", "child last name", "child_last_name", "family name"],
  parent_name: ["parent name", "parent_name", "parent", "guardian", "guardian name"],
  date_of_birth: ["dob", "date of birth", "date_of_birth", "birthday", "birth date"],
  age: ["age", "child age"],
  parent_email: ["email", "parent email", "parent_email", "contact email"],
  parent_phone: ["contact no", "contact_no", "phone", "parent phone", "parent_phone", "mobile", "contact number", "tel"],
  emergency_contact: ["emergency contact", "emergency_contact", "emergency", "emergency phone"],
  alternate_phone: ["alternate no", "alternate_no", "alternate phone", "alt phone", "alt no"],
  medical_condition: ["medical condition", "medical_condition", "condition", "health condition"],
  medical_notes: ["medical additional information", "medical_additional_information", "medical notes", "medical_notes", "medical info", "additional medical", "allergies"],
  photo_permission: ["photo permission", "photo_permission", "photo", "photos", "photo consent"],
  booking_date: ["booking date", "booking_date", "booked date", "date booked"],
  total_amount: ["total amount", "total_amount", "total", "price", "cost", "booking total"],
  sibling_discount: ["siblings discount", "sibling discount", "sibling_discount", "discount", "sibling"],
  amount_paid: ["amount paid", "amount_paid", "paid amount"],
  payment_status: ["status", "payment status", "payment_status", "payment state"],
  payment_type: ["payment type", "payment_type", "payment method", "method", "pay type"],
  refund_amount: ["refund amount", "refund_amount", "refund", "refunded"],
  amount_owed: ["amount owed", "amount_owed", "owed", "balance", "outstanding"],
  camp_name: ["camp", "camp name", "camp_name", "event", "event name"],
  camp_date: ["date", "camp date", "camp_date", "event date", "start date"],
  venue: ["venue", "location", "venue name", "ground", "pitch"],
  county: ["county", "area", "region"],
  kit_size: ["kit", "kit size", "kit_size", "jersey size", "size", "t-shirt size"],
  booking_status: ["booking status", "booking_status", "state"],
};

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2000-\u200A\u202F\u205F\u3000]/g, " ") // normalize exotic whitespace
    .replace(/[""'']/g, "") // strip smart quotes
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function autoMapColumn(header: string): string {
  const h = normalizeHeader(header);

  // Disambiguate generic "status" — only map to payment_status if it contains "payment"
  if (h === "status" || h === "state") {
    // bare "status"/"state" is ambiguous — leave unmapped
    console.log(`[BookingImport] Ambiguous header "${header}" — skipping (map manually if needed)`);
    return "skip";
  }

  // 1. Exact alias match
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(h) || h === field) return field;
  }

  // 2. Partial / contains match — alias is a substring of h, or h is a substring of alias
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      if (alias.length >= 4 && (h.includes(alias) || alias.includes(h))) {
        // Extra guard: don't let short header match long alias loosely
        if (h.length >= 3) return field;
      }
    }
  }

  console.log(`[BookingImport] Unmapped CSV header: "${header}" → normalized: "${h}"`);
  return "skip";
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  // Strip BOM and normalise line endings
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const firstLine = lines[0];

  // Detect delimiter by trying each and picking the one that yields the most columns
  const candidates: Array<{ delim: string; count: number }> = [
    { delim: ",", count: firstLine.split(",").length },
    { delim: ";", count: firstLine.split(";").length },
    { delim: "\t", count: firstLine.split("\t").length },
  ];
  candidates.sort((a, b) => b.count - a.count);
  const delimiter = candidates[0].count > 1 ? candidates[0].delim : ",";
  console.log(`[BookingImport] Detected delimiter: "${delimiter === "\t" ? "TAB" : delimiter}" (${candidates[0].count} columns)`);

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

  const rawHeaders = parseRow(lines[0]);
  // Normalize headers for consistent key access — strip BOM, exotic whitespace, smart quotes
  const headers = rawHeaders.map((h) =>
    h.replace(/^\uFEFF/, "")
     .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2000-\u200A\u202F\u205F\u3000]/g, " ")
     .replace(/[""'']/g, "")
     .replace(/\s+/g, " ")
     .trim()
  );
  console.log("[BookingImport] Parsed CSV headers:", headers);
  const rows = lines.slice(1).map((line) => {
    const vals = parseRow(line);
    const obj: ParsedRow = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
  return { headers, rows };
}

interface FilenameMetadata {
  campName: string;
  venue: string | null;
  county: string | null;
}

// Extract camp name from Teaching Tekkers filename format:
// "TeachingTekkers -Easter Camps (additional online charge with booking fees)-Meath-Athboy Celtic-Athboy Celtic Easter Camp 2026.csv"
// Segments after splitting on hyphens: [brand, programme(parenthetical stripped), county, club/venue, camp name]
// Camp name = last segment. Venue = second-to-last. County = third-to-last.
function extractMetadataFromFilename(filename: string): FilenameMetadata {
  const noExt = filename.replace(/\.(csv|tsv|txt)$/i, "").trim();
  const segments = noExt.split(/\s*[-–]\s*/).map((s) => s.replace(/\([^)]*\)/g, "").trim()).filter(Boolean);

  // The last segment is the camp name
  let campName = segments[segments.length - 1] || noExt;
  if (campName.length < 5 && segments.length > 1) {
    campName = segments[segments.length - 2] || campName;
  }

  // Venue = second-to-last (club name in TT format)
  let venue: string | null = null;
  if (segments.length >= 4) {
    venue = segments[segments.length - 2] || null;
  }

  // County = third-to-last
  let county: string | null = null;
  if (segments.length >= 4) {
    county = segments[segments.length - 3] || null;
  }

  return { campName: campName || noExt, venue, county };
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

  const allHeaders = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => f.headers.forEach((h) => set.add(h)));
    return Array.from(set);
  }, [files]);

  const totalRows = useMemo(() => files.reduce((s, f) => s + f.rows.length, 0), [files]);

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
      if (parsed.some((p) => p.name === file.name)) { loaded++; return; }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSV(text);
        if (headers.length > 0 && rows.length > 0) {
          const meta = extractMetadataFromFilename(file.name);
          const hasCampCol = headers.some((h) => autoMapColumn(h) === "camp_name");
          parsed.push({
            name: file.name,
            headers,
            rows,
            campNames: hasCampCol ? [] : [meta.campName],
            detectedCampName: meta.campName,
            detectedVenue: meta.venue,
            detectedCounty: meta.county,
          });
        }
        loaded++;
        if (loaded === validFiles.length) {
          setFiles([...parsed]);
          const mergedHeaders = new Set<string>();
          parsed.forEach((p) => p.headers.forEach((h) => mergedHeaders.add(h)));
          const autoMap: Record<string, string> = {};
          mergedHeaders.forEach((h) => { autoMap[h] = autoMapColumn(h); });
          console.log("[BookingImport] Auto-mapping result:", JSON.stringify(autoMap, null, 2));
          // Log first row raw data for finance debugging
          if (parsed[0]?.rows[0]) {
            const r = parsed[0].rows[0];
            const financeHeaders = ["Total Amount", "Siblings Discount", "Amount Paid", "Status", "Payment Type", "Refund Amount"];
            console.log("[BookingImport] First row ALL keys:", Object.keys(r));
            console.log("[BookingImport] First row ALL values:", JSON.stringify(r));
            for (const fh of financeHeaders) {
              console.log(`[BookingImport] row["${fh}"] =`, JSON.stringify(r[fh]), "| exists:", fh in r);
            }
          }
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
  const hasRequired = ["child_first_name", "child_last_name"].every((f) => mappedFields.includes(f));

  // Known Teaching Tekkers finance headers → field mapping (bypasses manual mapping)
  const TT_FINANCE_MAP: Record<string, string[]> = {
    total_amount: ["total amount", "total_amount", "total", "price", "cost"],
    sibling_discount: ["siblings discount", "sibling discount", "sibling_discount", "discount"],
    amount_paid: ["amount paid", "amount_paid", "paid amount", "paid"],
    payment_status: ["payment status", "payment_status"],
    payment_type: ["payment type", "payment_type", "payment method"],
    refund_amount: ["refund amount", "refund_amount", "refund"],
  };

  const getMappedRows = useCallback(() => {
    const allMapped: Record<string, string>[] = [];
    files.forEach((f) => {
      // Build a direct header→field index for finance fields from actual CSV headers
      const financeHeaderMap: Record<string, string> = {};
      for (const header of f.headers) {
        const norm = header.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        for (const [field, aliases] of Object.entries(TT_FINANCE_MAP)) {
          if (aliases.includes(norm) && !financeHeaderMap[field]) {
            financeHeaderMap[field] = header; // map field → actual CSV header key
          }
        }
      }
      if (f.rows[0]) {
        console.log("[BookingImport] Finance header detection:", JSON.stringify(financeHeaderMap));
      }

      const hasCampCol = f.headers.some((h) => mapping[h] === "camp_name");
      const hasVenueCol = f.headers.some((h) => mapping[h] === "venue");
      const hasCountyCol = f.headers.some((h) => mapping[h] === "county");
      f.rows.forEach((row, rowIdx) => {
        const mapped: Record<string, string> = {};
        for (const [csvCol, field] of Object.entries(mapping)) {
          if (field !== "skip" && row[csvCol] !== undefined && row[csvCol] !== "") mapped[field] = row[csvCol];
        }

        // Force-inject finance fields directly from raw CSV row using detected headers
        for (const [field, csvHeader] of Object.entries(financeHeaderMap)) {
          const val = row[csvHeader];
          if (val !== undefined && val !== "") {
            mapped[field] = val;
          }
        }

        if (rowIdx === 0) {
          console.log("[BookingImport] Row 0 FINAL finance:", {
            total_amount: mapped.total_amount,
            amount_paid: mapped.amount_paid,
            sibling_discount: mapped.sibling_discount,
            refund_amount: mapped.refund_amount,
            payment_status: mapped.payment_status,
            payment_type: mapped.payment_type,
          });
        }
        // Inject metadata from filename if not mapped from columns
        if (!hasCampCol || !mapped.camp_name) mapped.camp_name = f.detectedCampName;
        if ((!hasVenueCol || !mapped.venue) && f.detectedVenue) mapped.venue = f.detectedVenue;
        if ((!hasCountyCol || !mapped.county) && f.detectedCounty) mapped.county = f.detectedCounty;

        // Fallback external_booking_id when missing — prevents row collapse into updates
        if (!mapped.external_booking_id) {
          const parts = [
            (mapped.camp_name || "").trim(),
            (mapped.child_first_name || "").trim(),
            (mapped.child_last_name || "").trim(),
            (mapped.date_of_birth || mapped.parent_email || "").trim(),
          ].map(s => s.toLowerCase());
          mapped.external_booking_id = `gen_${parts.join("_").replace(/[^a-z0-9]/g, "_")}`;
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
              Upload one or more CSV files exported from the Teaching Tekkers booking system. The camp name is detected from the filename.
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
                      {(f.detectedVenue || f.detectedCounty) && (
                        <p className="text-xs text-muted-foreground">
                          {f.detectedVenue && <span>Venue: {f.detectedVenue}</span>}
                          {f.detectedVenue && f.detectedCounty && " • "}
                          {f.detectedCounty && <span>County: {f.detectedCounty}</span>}
                        </p>
                      )}
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
                  <span className="text-xs text-muted-foreground truncate max-w-40" title={sampleRow[h]}>
                    {sampleRow[h] || "—"}
                  </span>
                </div>
              ))}
            </div>

            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" multiple className="hidden" onChange={handleFileSelect} />

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={reset}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("preview")} disabled={!hasRequired}>
                  Preview
                </Button>
                <Button onClick={handleImport} disabled={!hasRequired}>
                  Import {totalRows} rows
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (() => {
          const previewRows = getMappedRows();
          const missingIdCount = previewRows.filter(r => !r.external_booking_id || r.external_booking_id.startsWith("gen_")).length;
          const missingIdPct = previewRows.length > 0 ? Math.round((missingIdCount / previewRows.length) * 100) : 0;
          return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Preview of mapped data (first 10 rows)</p>
            {missingIdPct > 50 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>{missingIdPct}% of rows</strong> have no Booking ID column mapped. Generated fallback IDs will be used, but re-importing the same file may create duplicates if child names or DOB vary slightly.
                </p>
              </div>
            )}
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {BOOKING_FIELDS.filter((f) => mappedFields.includes(f.key)).map((f) => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                    ))}
                    <TableHead className="text-xs">Camp (filename)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedRows().slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      {BOOKING_FIELDS.filter((f) => mappedFields.includes(f.key)).map((f) => (
                        <TableCell key={f.key} className="text-xs py-1.5">{row[f.key] || "—"}</TableCell>
                      ))}
                      <TableCell className="text-xs py-1.5">{row.camp_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport}>Import {totalRows} rows</Button>
            </div>
          </div>
          );
        })()}


        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Importing {totalRows} bookings from {files.length} file(s)…</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && result && (
          <div className="py-8 space-y-4 text-center">
            {result.failed > 0 ? (
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            ) : (
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
            )}
            <div>
              <p className="text-lg font-semibold text-foreground">Import Complete</p>
              <p className="text-sm text-muted-foreground">{files.length} file(s) processed</p>
            </div>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                <p className="text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-muted-foreground">Updated</p>
              </div>
              {result.failed > 0 && (
                <div>
                  <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                  <p className="text-muted-foreground">Failed</p>
                </div>
              )}
              {(result.camps_created ?? 0) > 0 && (
                <div>
                  <p className="text-2xl font-bold text-primary">{result.camps_created}</p>
                  <p className="text-muted-foreground">Camps Created</p>
                </div>
              )}
            </div>
            <Button onClick={() => handleClose(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
