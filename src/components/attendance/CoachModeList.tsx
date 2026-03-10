import { useCallback, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Heart, CameraOff, Shirt } from "lucide-react";
import { type ParticipantData } from "./AttendanceParticipantRow";

interface Props {
  participants: ParticipantData[];
  getStatus: (id: string) => "present" | "absent";
  onToggle: (id: string) => void;
  /** Immediately persist a single attendance toggle */
  onInstantSave: (id: string, status: "present" | "absent") => void;
}

function calcTotalCost(p: ParticipantData): number {
  return Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
}

export default function CoachModeList({ participants, getStatus, onToggle, onInstantSave }: Props) {
  const [quickInfoId, setQuickInfoId] = useState<string | null>(null);

  const handleRowTap = useCallback((id: string) => {
    const current = getStatus(id);
    const next = current === "present" ? "absent" : "present";
    onToggle(id);
    onInstantSave(id, next);
  }, [getStatus, onToggle, onInstantSave]);

  return (
    <div className="space-y-0.5">
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
            {/* Main row */}
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer select-none transition-colors ${
                isPresent
                  ? "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500"
                  : "bg-card border-l-4 border-l-transparent hover:bg-accent/30"
              }`}
              onClick={() => handleRowTap(p.id)}
            >
              <Checkbox
                checked={isPresent}
                className="h-5 w-5 shrink-0 pointer-events-none"
                tabIndex={-1}
              />

              {/* Name — tappable for quick info */}
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
              </button>

              {/* Age */}
              {p.age != null && (
                <span className="text-xs text-muted-foreground shrink-0 w-6 text-center">{p.age}</span>
              )}

              {/* Kit size */}
              <span className="text-[10px] text-muted-foreground shrink-0 w-6 text-center" title={`Kit: ${p.kit_size || "M"}`}>
                <Shirt className="h-3 w-3 mx-auto" />
                <span className="block leading-none">{p.kit_size || "M"}</span>
              </span>

              {/* Icons */}
              {hasMedical && <span className="text-destructive shrink-0" title="Medical notes">🏥</span>}
              {noPhoto && <CameraOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

              {/* Payment */}
              <Badge
                className={`text-[10px] shrink-0 min-w-[3rem] justify-center ${
                  isPaid ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                }`}
              >
                {isPaid ? "Paid" : `€${owed}`}
              </Badge>
            </div>

            {/* Inline quick info panel */}
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
                  <div><span className="text-muted-foreground">Kit:</span> <span className="font-medium">{p.kit_size || "M"}</span></div>
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
