import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Heart, CameraOff, StickyNote } from "lucide-react";
import { useState } from "react";

export interface ParticipantData {
  id: string;
  child_first_name: string;
  child_last_name: string;
  age: number | null;
  kit_size: string | null;
  medical_notes: string | null;
  photo_permission: boolean | null;
  payment_status: string | null;
  amount_paid: number | null;
  amount_owed: number | null;
  staff_notes: string | null;
}

interface Props {
  participant: ParticipantData;
  isPresent: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onFieldUpdate?: (id: string, field: string, value: any) => void;
  /** Show expanded detail on click instead of inline editing */
  expandedId?: string | null;
  onExpand?: (id: string | null) => void;
}

export default function AttendanceParticipantRow({
  participant: p,
  isPresent,
  onToggle,
  isAdmin = false,
  onFieldUpdate,
  expandedId,
  onExpand,
}: Props) {
  const isExpanded = expandedId === p.id;
  const hasMedical = !!p.medical_notes;
  const noPhoto = p.photo_permission === false;
  const isPaid = p.payment_status === "paid";

  return (
    <div className="rounded-lg border overflow-hidden transition-colors">
      {/* Main row — click to toggle attendance */}
      <div
        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
          isPresent ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-accent/30"
        }`}
        onClick={onToggle}
      >
        <Checkbox
          checked={isPresent}
          onCheckedChange={onToggle}
          className="h-5 w-5 shrink-0"
        />

        {/* Name + indicators */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">
              {p.child_first_name} {p.child_last_name}
            </span>
            {hasMedical && (
              <span title={p.medical_notes!} className="text-destructive text-xs">🏥</span>
            )}
            {noPhoto && (
              <span title="No photo permission" className="text-xs"><CameraOff className="h-3 w-3 text-muted-foreground" /></span>
            )}
          </div>
          {/* Compact info line */}
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {p.age != null && <span>Age {p.age}</span>}
            {p.kit_size && <span>• {p.kit_size}</span>}
            <span>• {isPaid ? "✅ Paid" : "⏳ Unpaid"}</span>
            {p.staff_notes && <span title={p.staff_notes}>• 📝</span>}
          </div>
        </div>

        {/* Expand toggle for details */}
        <button
          className="text-xs text-muted-foreground hover:text-foreground px-1"
          onClick={(e) => {
            e.stopPropagation();
            onExpand?.(isExpanded ? null : p.id);
          }}
          title="Details"
        >
          {isExpanded ? "▲" : "▼"}
        </button>

        <Badge variant={isPresent ? "default" : "secondary"} className="text-[10px] shrink-0">
          {isPresent ? "Present" : "Absent"}
        </Badge>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="border-t bg-muted/30 p-3 space-y-2 text-sm" onClick={(e) => e.stopPropagation()}>
          {/* Medical notes */}
          {hasMedical && (
            <div className="flex items-start gap-2">
              <Heart className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{p.medical_notes}</p>
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Age:</span>{" "}
              <span className="font-medium">{p.age ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Kit:</span>{" "}
              {isAdmin ? (
                <select
                  className="bg-background border rounded px-1 py-0.5 text-xs"
                  value={p.kit_size || "M"}
                  onChange={(e) => onFieldUpdate?.(p.id, "kit_size", e.target.value)}
                >
                  {["XS", "S", "M", "L", "XL"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="font-medium">{p.kit_size || "—"}</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Payment:</span>{" "}
              <Badge variant={isPaid ? "default" : "secondary"} className="text-[10px] ml-1">
                {isPaid ? "Paid" : "Unpaid"}
              </Badge>
            </div>
            {noPhoto && (
              <div className="flex items-center gap-1">
                <CameraOff className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">No photos</span>
              </div>
            )}
          </div>

          {/* Payment editing — admin only */}
          {isAdmin && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Amount Owed</label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={p.amount_owed ?? ""}
                  onChange={(e) => onFieldUpdate?.(p.id, "amount_owed", e.target.value ? Number(e.target.value) : 0)}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Amount Paid</label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={p.amount_paid ?? ""}
                  onChange={(e) => onFieldUpdate?.(p.id, "amount_paid", e.target.value ? Number(e.target.value) : 0)}
                />
              </div>
            </div>
          )}

          {/* Staff notes */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Staff Notes</label>
            {isAdmin ? (
              <Input
                className="h-7 text-xs mt-0.5"
                placeholder="e.g. early pickup, inhaler in bag…"
                value={p.staff_notes ?? ""}
                onChange={(e) => onFieldUpdate?.(p.id, "staff_notes", e.target.value)}
              />
            ) : (
              <p className="text-xs text-foreground mt-0.5">{p.staff_notes || "—"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
