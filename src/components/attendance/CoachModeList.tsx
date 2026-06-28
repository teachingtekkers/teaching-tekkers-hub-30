import { useCallback, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Heart, CameraOff, Shirt } from "lucide-react";
import { type ParticipantData } from "./AttendanceParticipantRow";
import { getKitSizeOptions, getKitSizeValue } from "@/lib/kitSizes";

interface Props {
  participants: ParticipantData[];
  getStatus: (id: string) => "present" | "absent";
  onToggle: (id: string) => void;
  /** Kept for backwards compatibility; AttendancePage already persists inside onToggle. */
  onInstantSave?: (id: string, status: "present" | "absent") => void;
  onFieldUpdate?: (id: string, field: string, value: any) => void;
}

function calcTotalCost(p: ParticipantData): number {
  return Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
}

export default function CoachModeList({ participants, getStatus, onToggle, onFieldUpdate }: Props) {
  const [quickInfoId, setQuickInfoId] = useState<string | null>(null);

  const handleRowTap = useCallback((id: string) => {
    onToggle(id);
  }, [onToggle]);

  return (
    <div className="space-y-1.5">
      {participants.map((p) => {
        const isPresent = getStatus(p.id) === "present";
        const hasMedical = !!(p.medical_condition || p.medical_notes);
        const noPhoto = p.photo_permission === false;
        const totalCost = calcTotalCost(p);
        const owed = p.amount_owed ?? Math.max(0, totalCost - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
        const isPaid = owed <= 0;
        const showQuickInfo = quickInfoId === p.id;

        return (
          <div key={p.id}>
            <div
              className={`rounded-md border-l-4 transition-colors ${
                isPresent
                  ? "bg-primary/10 border-l-primary"
                  : "bg-card border-l-transparent hover:bg-accent/30"
              }`}
            >
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                onClick={() => handleRowTap(p.id)}
              >
                <Checkbox
                  checked={isPresent}
                  className="h-5 w-5 shrink-0 pointer-events-none"
                  tabIndex={-1}
                />

                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickInfoId(showQuickInfo ? null : p.id);
                  }}
                >
                  <span className="text-sm font-medium text-foreground truncate block">
                    {p.child_first_name} {p.child_last_name}
                  </span>
                  <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Shirt className="h-3 w-3 shrink-0" />
                    <span className="shrink-0">Kit:</span>
                    <span className="truncate">{getKitSizeValue(p.kit_size)}</span>
                    {p.kit_given && <span className="shrink-0 text-emerald-600">✓ received</span>}
                  </span>
                </button>

                {p.age != null && (
                  <span className="text-xs text-muted-foreground shrink-0 w-6 text-center">{p.age}</span>
                )}
                {hasMedical && <span className="text-destructive shrink-0" title="Medical notes">🏥</span>}
                {noPhoto && <CameraOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

                <Badge
                  className={`text-[10px] shrink-0 min-w-[3rem] justify-center ${
                    isPaid ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                  }`}
                >
                  {isPaid ? "Paid" : `€${owed}`}
                </Badge>
              </div>

              <div
                className="mx-3 mb-2 grid gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="grid gap-1 min-w-0">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                    <Shirt className={`h-4 w-4 shrink-0 ${p.kit_given ? "text-emerald-600" : "text-primary"}`} />
                    Kit Size
                  </span>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                    value={getKitSizeValue(p.kit_size)}
                    onChange={(e) => onFieldUpdate?.(p.id, "kit_size", e.target.value)}
                    aria-label="Kit size"
                  >
                    {getKitSizeOptions(p.kit_size).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-10 items-center justify-center gap-2 cursor-pointer rounded-md border border-border bg-background px-3">
                  <Checkbox
                    checked={!!p.kit_given}
                    onCheckedChange={(v) => onFieldUpdate?.(p.id, "kit_given", v === true)}
                    className="h-4 w-4"
                    aria-label="Kit received"
                  />
                  <span className="text-sm font-semibold text-foreground">Kit Received</span>
                </label>
              </div>
            </div>

            {showQuickInfo && (
              <div
                className="ml-8 mr-2 mb-1 p-2.5 rounded-md bg-muted/50 border text-xs space-y-1 animate-in slide-in-from-top-1 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {p.parent_name && (
                    <div><span className="text-muted-foreground">Parent:</span> <span className="font-medium">{p.parent_name}</span></div>
                  )}
                  {p.parent_phone && (
                    <div><span className="text-muted-foreground">Phone:</span> <a href={`tel:${p.parent_phone}`} className="font-medium text-primary">{p.parent_phone}</a></div>
                  )}
                  {p.alternate_phone && (
                    <div><span className="text-muted-foreground">Alt:</span> <span className="font-medium">{p.alternate_phone}</span></div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Kit:</span>{" "}
                    <span className="font-medium">{getKitSizeValue(p.kit_size)}{p.kit_given ? " • received" : ""}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment:</span>{" "}
                    <span className={`font-medium ${isPaid ? "text-emerald-600" : "text-amber-600"}`}>
                      {isPaid ? "Paid" : `€${owed} owed`}
                    </span>
                    {p.payment_type && <span className="text-muted-foreground"> • {p.payment_type}</span>}
                  </div>
                </div>
                {hasMedical && (
                  <div className="flex items-start gap-1.5 bg-destructive/10 rounded p-1.5 mt-1">
                    <Heart className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                    <span className="text-destructive">{[p.medical_condition, p.medical_notes].filter(Boolean).join(" — ")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}