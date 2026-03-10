import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Heart, CameraOff, StickyNote } from "lucide-react";
import { useState } from "react";

export interface ParticipantData {
  id: string;
  child_first_name: string;
  child_last_name: string;
  age: number | null;
  date_of_birth: string | null;
  kit_size: string | null;
  medical_condition: string | null;
  medical_notes: string | null;
  photo_permission: boolean | null;
  payment_status: string | null;
  amount_paid: number | null;
  amount_owed: number | null;
  total_amount: number | null;
  sibling_discount: number | null;
  refund_amount: number | null;
  payment_type: string | null;
  staff_notes: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  emergency_contact: string | null;
  alternate_phone: string | null;
  booking_date: string | null;
}

interface Props {
  participant: ParticipantData;
  isPresent: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onFieldUpdate?: (id: string, field: string, value: any) => void;
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
  const hasMedical = !!(p.medical_condition || p.medical_notes);
  const noPhoto = p.photo_permission === false;
  const isPaid = p.payment_status === "paid";

  const medicalText = [p.medical_condition, p.medical_notes].filter(Boolean).join(" — ");

  return (
    <div className="rounded-lg border overflow-hidden transition-colors">
      {/* Main row */}
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">
              {p.child_first_name} {p.child_last_name}
            </span>
            {hasMedical && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-destructive text-xs cursor-pointer" onClick={(e) => e.stopPropagation()}>🏥</button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto max-w-60 p-2 text-xs text-destructive" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start gap-1.5">
                    <Heart className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{medicalText}</span>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {noPhoto && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-xs cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <CameraOff className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto max-w-48 p-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  📷🚫 No photo permission
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {p.parent_name && <span>{p.parent_name}</span>}
            {p.parent_phone && (
              <>
                <span>•</span>
                <a href={`tel:${p.parent_phone}`} className="text-primary" onClick={(e) => e.stopPropagation()}>{p.parent_phone}</a>
              </>
            )}
            {p.age != null && <><span>•</span><span>Age {p.age}</span></>}
            <span className={isPaid ? "text-emerald-600" : "text-amber-600"}>
              • {isPaid ? "✅ Paid" : (p.amount_owed && p.amount_owed > 0) ? `⏳ €${p.amount_owed} owed` : "⏳ Unpaid"}
            </span>
            {p.staff_notes && <span title={p.staff_notes}>• 📝</span>}
          </div>
        </div>

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
          {hasMedical && (
            <div className="flex items-start gap-2">
              <Heart className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{medicalText}</p>
            </div>
          )}

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Age:</span>{" "}
              <span className="font-medium">{p.age ?? "—"}{p.date_of_birth ? ` (${p.date_of_birth})` : ""}</span>
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
            {p.parent_name && (
              <div>
                <span className="text-muted-foreground">Parent:</span>{" "}
                <span className="font-medium">{p.parent_name}</span>
              </div>
            )}
            {p.parent_phone && (
              <div>
                <span className="text-muted-foreground">Phone:</span>{" "}
                <a href={`tel:${p.parent_phone}`} className="font-medium text-primary">{p.parent_phone}</a>
              </div>
            )}
            {p.parent_email && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{p.parent_email}</span>
              </div>
            )}
            {p.emergency_contact && (
              <div>
                <span className="text-muted-foreground">Emergency:</span>{" "}
                <a href={`tel:${p.emergency_contact}`} className="font-medium text-destructive">{p.emergency_contact}</a>
              </div>
            )}
            {p.alternate_phone && (
              <div>
                <span className="text-muted-foreground">Alt Phone:</span>{" "}
                <span className="font-medium">{p.alternate_phone}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Payment:</span>{" "}
              <Badge variant={isPaid ? "default" : "secondary"} className="text-[10px] ml-1">
                {isPaid ? "Paid" : p.payment_status || "Unpaid"}
              </Badge>
              {p.payment_type && (
                <span className="text-muted-foreground ml-1">({p.payment_type})</span>
              )}
            </div>
            {noPhoto && (
              <div className="flex items-center gap-1">
                <CameraOff className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">No photos</span>
              </div>
            )}
          </div>

          {/* Finance summary */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Total:</span>{" "}
              <span className="font-medium">€{p.total_amount ?? 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Paid:</span>{" "}
              <span className="font-medium text-emerald-600">€{p.amount_paid ?? 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Owed:</span>{" "}
              <span className={`font-medium ${(p.amount_owed ?? 0) > 0 ? "text-amber-600" : ""}`}>€{p.amount_owed ?? 0}</span>
            </div>
          </div>
          {(p.sibling_discount ?? 0) > 0 && (
            <div className="text-xs text-muted-foreground">
              Sibling discount: €{p.sibling_discount}
            </div>
          )}

          {/* Debug: confirm data flow from synced booking */}
          <div className="border border-dashed border-muted-foreground/30 rounded p-2 space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">🔍 Debug — Synced Booking Data</p>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <span className="text-muted-foreground">synced total_amount:</span>
              <span className="font-mono">{p.total_amount ?? "null"}</span>
              <span className="text-muted-foreground">synced amount_paid:</span>
              <span className="font-mono">{p.amount_paid ?? "null"}</span>
              <span className="text-muted-foreground">synced refund_amount:</span>
              <span className="font-mono">{p.refund_amount ?? "null"}</span>
              <span className="text-muted-foreground">synced sibling_discount:</span>
              <span className="font-mono">{p.sibling_discount ?? "null"}</span>
              <span className="text-muted-foreground">synced payment_status:</span>
              <span className="font-mono">{p.payment_status ?? "null"}</span>
              <span className="text-muted-foreground">synced payment_type:</span>
              <span className="font-mono">{p.payment_type ?? "null"}</span>
              <span className="text-muted-foreground">calculated amount_owed:</span>
              <span className="font-mono">{p.amount_owed ?? "null"}</span>
            </div>
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
