import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Scan,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type {
  RosterCamp,
  RosterCoach,
  DailyAssignment,
} from "@/pages/RosterPage";

type Role = "head_coach" | "assistant" | "helper";

interface ExtractedCoach {
  rowId: string;
  name: string;
  role: Role;
  days: string[]; // weekday names: Mon, Tue, Wed, Thu, Fri
  notes: string;
  matchedCoachId: string | null; // null = unmatched, "__create__" = create new
}

interface ExtractedRoster {
  campId: string | null; // chosen camp from week
  weekLabel: string;
  campNameRaw: string;
  coaches: ExtractedCoach[];
}

interface Props {
  weekStart: Date;
  weekEnd: Date;
  weekStartStr: string;
  camps: RosterCamp[];
  allCoaches: RosterCoach[];
  currentAssignments: DailyAssignment[];
  availableCoachIds: string[];
  savedRosterId: string | null;
  onImportComplete: () => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function nameSimilarity(a: string, b: string): number {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let overlap = 0;
  ta.forEach((t) => { if (tb.has(t)) overlap += 1; });
  const denom = Math.max(ta.size, tb.size);
  return denom === 0 ? 0 : overlap / denom;
}

function findBestCoachMatch(name: string, coaches: RosterCoach[]): string | null {
  let best: { id: string; score: number } | null = null;
  for (const c of coaches) {
    const s = nameSimilarity(name, c.full_name);
    if (s >= 0.5 && (!best || s > best.score)) best = { id: c.id, score: s };
  }
  return best ? best.id : null;
}

function findBestCampMatch(name: string, camps: RosterCamp[]): string | null {
  if (!name) return null;
  let best: { id: string; score: number } | null = null;
  for (const c of camps) {
    const target = `${c.club_name} ${c.name} ${c.venue}`;
    const s = nameSimilarity(name, target);
    if (s >= 0.3 && (!best || s > best.score)) best = { id: c.id, score: s };
  }
  return best ? best.id : null;
}

function weekdayToDateStr(weekday: string, weekStart: Date): string | null {
  const idx = WEEKDAYS.indexOf(weekday);
  if (idx < 0) return null;
  const d = new Date(weekStart);
  d.setDate(d.getDate() + idx);
  return format(d, "yyyy-MM-dd");
}

export function RosterScreenshotImport({
  weekStart,
  weekEnd,
  weekStartStr,
  camps,
  allCoaches,
  currentAssignments,
  availableCoachIds,
  savedRosterId,
  onImportComplete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedRoster | null>(null);

  const sortedCoaches = useMemo(
    () => [...allCoaches].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [allCoaches]
  );

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      sonnerToast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      await runExtraction(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runExtraction = async (dataUrl: string) => {
    setExtracting(true);
    setExtracted(null);
    try {
      const { data, error } = await supabase.functions.invoke("extract-roster-from-image", {
        body: { image: dataUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const rawCoaches: { name?: string; role?: string; days?: string[]; notes?: string }[] = data?.coaches || [];
      const campId = findBestCampMatch(data?.camp_name || "", camps);

      const coaches: ExtractedCoach[] = rawCoaches.map((c, i) => {
        const name = (c.name || "").trim();
        const rawRole = (c.role || "coach").toLowerCase();
        const role: Role =
          rawRole === "head_coach" || rawRole === "head coach" || rawRole === "hc"
            ? "head_coach"
            : rawRole === "helper"
            ? "helper"
            : "assistant";
        const days = (c.days || []).filter((d) => WEEKDAYS.includes(d));
        return {
          rowId: `row-${Date.now()}-${i}`,
          name,
          role,
          days,
          notes: (c.notes || "").trim(),
          matchedCoachId: findBestCoachMatch(name, sortedCoaches),
        };
      });

      setExtracted({
        campId,
        weekLabel: data?.week_label || "",
        campNameRaw: data?.camp_name || "",
        coaches,
      });
      sonnerToast.success(`Extracted ${coaches.length} coach${coaches.length === 1 ? "" : "es"}. Review and confirm below.`);
    } catch (e) {
      console.error(e);
      sonnerToast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const updateCoach = (rowId: string, patch: Partial<ExtractedCoach>) => {
    setExtracted((prev) =>
      prev
        ? { ...prev, coaches: prev.coaches.map((c) => (c.rowId === rowId ? { ...c, ...patch } : c)) }
        : prev
    );
  };

  const toggleDay = (rowId: string, day: string) => {
    setExtracted((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        coaches: prev.coaches.map((c) => {
          if (c.rowId !== rowId) return c;
          const has = c.days.includes(day);
          return {
            ...c,
            days: has
              ? c.days.filter((d) => d !== day)
              : [...c.days, day].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
          };
        }),
      };
    });
  };

  const addRow = () => {
    setExtracted((prev) =>
      prev
        ? {
            ...prev,
            coaches: [
              ...prev.coaches,
              {
                rowId: `row-${Date.now()}-${prev.coaches.length}`,
                name: "",
                role: "assistant",
                days: [],
                notes: "",
                matchedCoachId: null,
              },
            ],
          }
        : prev
    );
  };

  const removeRow = (rowId: string) => {
    setExtracted((prev) =>
      prev ? { ...prev, coaches: prev.coaches.filter((c) => c.rowId !== rowId) } : prev
    );
  };

  const reset = () => {
    setExtracted(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Validation
  const validationIssues = useMemo(() => {
    if (!extracted) return [] as string[];
    const issues: string[] = [];
    if (!extracted.campId) issues.push("Select which camp this roster is for.");
    extracted.coaches.forEach((c, i) => {
      const label = c.name || `Row ${i + 1}`;
      if (!c.name.trim()) issues.push(`Row ${i + 1}: coach name is empty.`);
      if (!c.matchedCoachId) issues.push(`${label}: choose a matching staff profile or create a new one.`);
      if (c.days.length === 0) issues.push(`${label}: at least one working day must be ticked.`);
    });
    return issues;
  }, [extracted]);

  const canConfirm = extracted && validationIssues.length === 0 && !saving;

  const confirmImport = async () => {
    if (!extracted || !extracted.campId) return;
    setSaving(true);
    try {
      // 1) Create any new coach profiles requested
      const newProfiles = extracted.coaches.filter((c) => c.matchedCoachId === "__create__");
      const createdMap = new Map<string, string>(); // rowId -> new coach id
      for (const np of newProfiles) {
        const { data, error } = await supabase
          .from("coaches")
          .insert({
            full_name: np.name.trim(),
            phone: "",
            email: "",
            is_head_coach: np.role === "head_coach",
            role_type: np.role === "head_coach" ? "head_coach" : "assistant",
            daily_rate: 0,
            head_coach_daily_rate: 0,
            status: "active",
            notes: "Created from roster screenshot import",
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(`Failed to create coach ${np.name}: ${error?.message}`);
        createdMap.set(np.rowId, data.id);
      }

      // 2) Build new assignments for this camp
      const campId = extracted.campId;
      const newCampAssignments: DailyAssignment[] = extracted.coaches.map((c, i) => {
        const coachId = c.matchedCoachId === "__create__" ? createdMap.get(c.rowId)! : c.matchedCoachId!;
        const dayDates = c.days
          .map((d) => weekdayToDateStr(d, weekStart))
          .filter((d): d is string => !!d);
        return {
          id: `imp-${Date.now()}-${i}`,
          camp_id: campId,
          coach_id: coachId,
          role: c.role,
          days: dayDates,
          driving_this_week: false,
          grant_camp_access: c.role === "head_coach",
        };
      });

      // 3) Merge with current assignments: drop any prior rows for this camp, append new
      const mergedAssignments: DailyAssignment[] = [
        ...currentAssignments.filter((a) => a.camp_id !== campId),
        ...newCampAssignments,
      ];

      // 4) Ensure all involved coaches are in the availability pool
      const allCoachIds = new Set<string>(availableCoachIds);
      newCampAssignments.forEach((a) => allCoachIds.add(a.coach_id));
      const updatedAvailable = Array.from(allCoachIds);

      const uniqueCoachIds = new Set(mergedAssignments.map((a) => a.coach_id));
      const rosterPayload = {
        week_start: weekStartStr,
        assignments: JSON.parse(JSON.stringify(mergedAssignments)),
        available_coach_ids: JSON.parse(JSON.stringify(updatedAvailable)),
        status: "draft" as const,
        camps_count: new Set(mergedAssignments.map((a) => a.camp_id)).size,
        coaches_count: uniqueCoachIds.size,
        updated_at: new Date().toISOString(),
      };

      let rosterResult;
      if (savedRosterId) {
        rosterResult = await supabase
          .from("weekly_rosters")
          .update(rosterPayload)
          .eq("id", savedRosterId)
          .select()
          .single();
      } else {
        rosterResult = await supabase.from("weekly_rosters").insert(rosterPayload).select().single();
      }
      if (rosterResult.error) throw new Error(rosterResult.error.message);

      // 5) Create DRAFT payroll_records for each coach on this camp/week
      const allCoachesById = new Map(allCoaches.map((c) => [c.id, c]));
      for (const a of newCampAssignments) {
        const coach = allCoachesById.get(a.coach_id);
        const isHead = a.role === "head_coach";
        const rate = isHead
          ? Number(coach?.head_coach_daily_rate || coach?.daily_rate || 0)
          : Number(coach?.daily_rate || 0);
        const daysWorked = a.days.length;
        const basePay = rate * daysWorked;
        const fuel = coach?.fuel_allowance_eligible ? 20 : 0; // matches PayrollPage default
        const total = basePay + fuel;
        const rowNotes = extracted.coaches.find(
          (c) => (c.matchedCoachId === "__create__" ? createdMap.get(c.rowId) : c.matchedCoachId) === a.coach_id
        )?.notes || "";

        const { error: prError } = await supabase.from("payroll_records").upsert(
          {
            coach_id: a.coach_id,
            camp_id: a.camp_id,
            week_start: weekStartStr,
            role: a.role,
            days_worked: daysWorked,
            daily_rate_used: rate,
            base_pay: basePay,
            fuel_allowance: fuel,
            camp_bonus: 0,
            bonus: 0,
            manual_adjustment: 0,
            total_amount: total,
            status: "draft",
            notes: rowNotes
              ? `Imported from roster screenshot — ${rowNotes}`
              : "Imported from roster screenshot",
          } as any,
          { onConflict: "coach_id,camp_id,week_start" }
        );
        if (prError) throw new Error(prError.message);
      }

      // 6) Ensure head coaches get camp_coach_assignments access
      for (const a of newCampAssignments) {
        if (a.role !== "head_coach" && !a.grant_camp_access) continue;
        const { data: existing } = await supabase
          .from("camp_coach_assignments")
          .select("id, role")
          .eq("camp_id", a.camp_id)
          .eq("coach_id", a.coach_id)
          .maybeSingle();
        if (existing) {
          if (existing.role !== a.role) {
            await supabase.from("camp_coach_assignments").update({ role: a.role }).eq("id", existing.id);
          }
        } else {
          await supabase
            .from("camp_coach_assignments")
            .insert({ camp_id: a.camp_id, coach_id: a.coach_id, role: a.role });
        }
      }

      sonnerToast.success(
        `Roster imported. ${newCampAssignments.length} coach${newCampAssignments.length === 1 ? "" : "es"} added. Draft payroll created.`
      );
      reset();
      onImportComplete();
    } catch (e) {
      console.error(e);
      sonnerToast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- UI ----------------

  if (!extracted && !extracting) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Scan className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Import Roster from Screenshot</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a photo or screenshot of your weekly roster. The app will extract coach names, days and roles for you to review before saving.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" /> Upload Roster Image
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Week commencing <strong>{format(weekStart, "EEEE d MMMM yyyy")}</strong>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (extracting) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <div className="font-medium">Scanning roster…</div>
            <p className="text-sm text-muted-foreground">
              Extracting coach names, days and roles from your screenshot.
            </p>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Roster preview"
                className="mt-4 max-h-48 rounded border object-contain"
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!extracted) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Uploaded roster"
                className="h-32 rounded border object-contain bg-muted/30"
              />
            )}
            <div className="flex-1 min-w-[260px] space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Camp / Club</Label>
                  <Select
                    value={extracted.campId || ""}
                    onValueChange={(v) =>
                      setExtracted((prev) => (prev ? { ...prev, campId: v } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select camp…" />
                    </SelectTrigger>
                    <SelectContent>
                      {camps.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.club_name} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {extracted.campNameRaw && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Detected: <em>{extracted.campNameRaw}</em>
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Week</Label>
                  <div className="h-9 px-3 flex items-center rounded-md border bg-muted/30 text-sm">
                    {format(weekStart, "EEE d MMM")} – {format(weekEnd, "EEE d MMM yyyy")}
                  </div>
                  {extracted.weekLabel && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Detected on image: <em>{extracted.weekLabel}</em>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Upload different image
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Extracted Coaches</h4>
              <p className="text-xs text-muted-foreground">
                Match each coach to a staff profile, then tick the days they're working.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addRow} className="gap-2">
              <Plus className="h-4 w-4" /> Add Row
            </Button>
          </div>

          <div className="divide-y">
            {extracted.coaches.map((c) => {
              const flagged = !c.matchedCoachId;
              const matchedCoach = c.matchedCoachId && c.matchedCoachId !== "__create__"
                ? allCoaches.find((x) => x.id === c.matchedCoachId)
                : null;
              return (
                <div key={c.rowId} className="p-4 space-y-3">
                  <div className="grid md:grid-cols-12 gap-3 items-start">
                    <div className="md:col-span-3">
                      <Label className="text-xs">Name on Roster</Label>
                      <Input
                        value={c.name}
                        onChange={(e) => updateCoach(c.rowId, { name: e.target.value })}
                        placeholder="Coach name"
                      />
                      {flagged && (
                        <Badge variant="outline" className="mt-1 text-xs text-orange-600 border-orange-300 gap-1">
                          <AlertTriangle className="h-3 w-3" /> Needs match
                        </Badge>
                      )}
                      {matchedCoach && (
                        <Badge variant="secondary" className="mt-1 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Matched
                        </Badge>
                      )}
                      {c.matchedCoachId === "__create__" && (
                        <Badge variant="default" className="mt-1 text-xs">
                          Will create new profile
                        </Badge>
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-xs">Staff Profile</Label>
                      <Select
                        value={c.matchedCoachId || ""}
                        onValueChange={(v) => updateCoach(c.rowId, { matchedCoachId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select coach…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__create__">+ Create new profile from name</SelectItem>
                          {sortedCoaches.map((sc) => (
                            <SelectItem key={sc.id} value={sc.id}>
                              {sc.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs">Role</Label>
                      <Select
                        value={c.role}
                        onValueChange={(v) => updateCoach(c.rowId, { role: v as Role })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="head_coach">Head Coach</SelectItem>
                          <SelectItem value="assistant">Coach</SelectItem>
                          <SelectItem value="helper">Helper</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-3">
                      <Label className="text-xs">Days Working</Label>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {WEEKDAYS.map((d) => {
                          const checked = c.days.includes(d);
                          return (
                            <label
                              key={d}
                              className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer ${
                                checked ? "bg-primary/10 border-primary" : "bg-muted/30"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleDay(c.rowId, d)}
                              />
                              {d}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-1 flex md:justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(c.rowId)}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {c.notes && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Note:</span>{" "}
                      <Input
                        value={c.notes}
                        onChange={(e) => updateCoach(c.rowId, { notes: e.target.value })}
                        className="inline-block w-auto h-7 text-xs ml-1"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {extracted.coaches.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No coaches extracted. Use <strong>Add Row</strong> to enter them manually.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {validationIssues.length > 0 && (
        <Card className="border-orange-300">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium mb-1">Resolve before confirming:</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  {validationIssues.slice(0, 6).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {validationIssues.length > 6 && (
                    <li>+ {validationIssues.length - 6} more…</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={reset} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={confirmImport} disabled={!canConfirm} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? "Saving…" : "Confirm & Update Roster + Wages"}
        </Button>
      </div>
    </div>
  );
}