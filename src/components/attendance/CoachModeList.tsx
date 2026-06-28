import { useCallback, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banknote, Heart, CameraOff, Shirt } from "lucide-react";
import { type ParticipantData } from "./AttendanceParticipantRow";
import { getKitSizeOptions, getKitSizeValue } from "@/lib/kitSizes";

interface Props {
  participants: ParticipantData[];
  getStatus: (id: string) => "present" | "absent";
  onToggle: (id: string) => void;
  /** Kept for backwards compatibility; AttendancePage already persists inside onToggle. */
  onInstantSave?: (id: string, status: "present" | "absent") => void;
  onFieldUpdate?: (id: string, field: string, value: any) => void;
  onPaymentUpdate?: (id: string, updates: Record<string, any>) => void;
}

function calcTotalCost(p: ParticipantData): number {
  return Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
}

export default function CoachModeList({ participants, getStatus, onToggle, onFieldUpdate, onPaymentUpdate }: Props) {
  const [quickInfoId, setQuickInfoId] = useState<string | null>(null);

  const handlePresenceToggle = useCallback((id: string) => {
    onToggle(id);
  }, [onToggle]);

  const handleMarkPaid = useCallback((p: ParticipantData) => {
    const totalCost = calcTotalCost(p);
    onPaymentUpdate?.(p.id, {
      amount_paid: totalCost > 0 ? totalCost : (p.amount_paid ?? 0),
      amount_owed: 0,
      payment_status: "paid",
    });
  }, [onPaymentUpdate]);

  return (
    <div className="space-y-1.5">
      {participants.map((p) => {
        const isPresent = getStatus(p.id) === "present";
        const hasMedical = !!(p.medical_condition || p.medical_notes);
        const noPhoto = p.photo_permission === false;
        const totalCost = calcTotalCost(p);
        const owed = p.amount_owed ?? Math.max(0, totalCost - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
        const isPaid = p.payment_status === "paid" || (totalCost > 0 && owed <= 0);
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
              <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="flex min-w-0 items-start gap-3">
                  <label
                    className="flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border bg-background px-2 py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isPresent}
                      onCheckedChange={() => handlePresenceToggle(p.id)}
                      className="h-5 w-5"
                      aria-label="Present"
                    />
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Present</span>
                  </label>

                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickInfoId(showQuickInfo ? null : p.id);
                    }}
                  >
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {p.child_first_name} {p.child_last_name}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {p.age != null && <span>Age {p.age}</span>}
                      {hasMedical && <span className="font-medium text-destructive">🏥 Medical</span>}
                      {noPhoto && <span className="inline-flex items-center gap-1"><CameraOff className="h-3 w-3" /> No photo</span>}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <Badge
                    className={`min-w-[4.25rem] justify-center text-[11px] ${
                      isPaid ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                    }`}
                  >
                    {isPaid ? "Paid" : `€${owed} owed`}
                  </Badge>
                  {!isPaid && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkPaid(p);
                      }}
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      Mark Paid
                    </Button>
                  )}
                </div>
              </div>

              <div
                className="mx-3 mb-3 grid gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center"
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