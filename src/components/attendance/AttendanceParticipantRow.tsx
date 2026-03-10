import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Heart, CameraOff, Banknote } from "lucide-react";
import { useCallback, useRef } from "react";

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

function calcTotalCost(p: ParticipantData): number {
  return Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
}

function deriveStatus(owed: number): string {
  return owed <= 0 ? "paid" : "pending";
}

function formatCurrency(n: number): string {
  return `€${n.toFixed(0)}`;
}

interface Props {
  participant: ParticipantData;
  isPresent: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onFieldUpdate?: (id: string, field: string, value: any) => void;
  onPaymentUpdate?: (id: string, updates: Record<string, any>) => void;
  expandedId?: string | null;
  onExpand?: (id: string | null) => void;
}

export default function AttendanceParticipantRow({
  participant: p,
  isPresent,
  onToggle,
  isAdmin = false,
  onFieldUpdate,
  onPaymentUpdate,
  expandedId,
  onExpand,
}: Props) {
  const isExpanded = expandedId === p.id;
  const hasMedical = !!(p.medical_condition || p.medical_notes);
  const noPhoto = p.photo_permission === false;

  const totalCost = calcTotalCost(p);
  const currentPaid = p.amount_paid ?? 0;
  const currentOwed = p.amount_owed ?? Math.max(0, totalCost - currentPaid - (p.refund_amount ?? 0));
  const status = deriveStatus(currentOwed);

  const medicalText = [p.medical_condition, p.medical_notes].filter(Boolean).join(" — ");

  const paidInputRef = useRef<HTMLInputElement>(null);
  const owedInputRef = useRef<HTMLInputElement>(null);

  const handleAmountPaidBlur = useCallback((val: string) => {
    const cleaned = val.replace(/^0+(?=\d)/, "");
    const paid = cleaned === "" ? 0 : Math.max(0, Number(cleaned));
    const owed = Math.max(0, totalCost - paid - (p.refund_amount ?? 0));
    const newStatus = deriveStatus(owed);
    onPaymentUpdate?.(p.id, { amount_paid: paid, amount_owed: owed, payment_status: newStatus });
  }, [p.id, totalCost, p.refund_amount, onPaymentUpdate]);

  const handleAmountOwedBlur = useCallback((val: string) => {
    const cleaned = val.replace(/^0+(?=\d)/, "");
    const owed = cleaned === "" ? 0 : Math.max(0, Number(cleaned));
    const newStatus = deriveStatus(owed);
    onPaymentUpdate?.(p.id, { amount_owed: owed, payment_status: newStatus });
  }, [p.id, onPaymentUpdate]);

  const handleMarkPaid = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPaymentUpdate?.(p.id, { amount_paid: totalCost, amount_owed: 0, payment_status: "paid" });
  }, [p.id, totalCost, onPaymentUpdate]);

  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  // Payment summary line for the row
  const paymentSummary = status === "paid"
    ? `Paid${p.payment_type ? ` • ${p.payment_type}` : ""}`
    : `${formatCurrency(currentOwed)} owed${p.payment_type ? ` • ${p.payment_type}` : ""}`;

  return (
    <div className="rounded-lg border overflow-hidden transition-colors">
      {/* Main row */}
      <div
        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
          isPresent ? "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500" : "bg-card hover:bg-accent/30"
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
            {p.age != null && <span className="text-xs text-muted-foreground">(Age {p.age})</span>}
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
              <CameraOff className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {p.parent_phone && (
              <a href={`tel:${p.parent_phone}`} className="text-primary" onClick={(e) => e.stopPropagation()}>{p.parent_phone}</a>
            )}
            <span className={status === "paid" ? "text-emerald-600" : "text-amber-600"}>
              • {paymentSummary}
            </span>
          </div>
        </div>

        {/* Quick Mark Paid */}
        {status !== "paid" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
            onClick={handleMarkPaid}
            title="Mark Paid"
          >
            <Banknote className="h-3.5 w-3.5" />
            Paid
          </Button>
        )}

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

        <Badge
          variant={isPresent ? "default" : "secondary"}
          className={`text-[10px] shrink-0 ${isPresent ? "bg-blue-600" : ""}`}
        >
          {isPresent ? "Present" : "Absent"}
        </Badge>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="border-t bg-muted/30 p-3 space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
          {hasMedical && (
            <div className="flex items-start gap-2 bg-destructive/10 rounded p-2">
              <Heart className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{medicalText}</p>
            </div>
          )}

          {/* Contact info — Parent phone first */}
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Contact</div>
            <div className="grid grid-cols-2 gap-2">
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
              {p.alternate_phone && (
                <div>
                  <span className="text-muted-foreground">Alt Phone:</span>{" "}
                  <span className="font-medium">{p.alternate_phone}</span>
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
            </div>
          </div>

          {/* Child details */}
          <div className="grid grid-cols-3 gap-2 text-xs">
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
            {noPhoto && (
              <div className="flex items-center gap-1">
                <CameraOff className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">No photos</span>
              </div>
            )}
          </div>

          {/* Payment section */}
          <div className="border rounded-lg p-3 space-y-2 bg-background">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment</span>
              <div className="flex items-center gap-2">
                {p.payment_type && (
                  <span className="text-[11px] text-muted-foreground">{p.payment_type}</span>
                )}
                <Badge
                  className={`text-[10px] ${status === "paid" ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}
                >
                  {status === "paid" ? "Paid" : "Pending"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-medium block">{formatCurrency(totalCost)}</span>
                {(p.sibling_discount ?? 0) > 0 && (
                  <span className="text-[10px] text-muted-foreground">{formatCurrency(p.total_amount ?? 0)} − {formatCurrency(p.sibling_discount!)} disc.</span>
                )}
              </div>
              <div>
                <label className="text-muted-foreground block mb-0.5">Paid</label>
                <Input
                  ref={paidInputRef}
                  type="number"
                  min="0"
                  step="1"
                  className="h-7 text-xs w-full"
                  defaultValue={currentPaid}
                  key={`paid-${p.id}-${currentPaid}`}
                  onFocus={handleInputFocus}
                  onBlur={(e) => handleAmountPaidBlur(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-0.5">Owed</label>
                <Input
                  ref={owedInputRef}
                  type="number"
                  min="0"
                  step="1"
                  className="h-7 text-xs w-full"
                  defaultValue={currentOwed}
                  key={`owed-${p.id}-${currentOwed}`}
                  onFocus={handleInputFocus}
                  onBlur={(e) => handleAmountOwedBlur(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status !== "paid" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                  onClick={handleMarkPaid}
                >
                  <Banknote className="h-3.5 w-3.5" />
                  Mark Paid ({formatCurrency(totalCost)})
                </Button>
              )}
              {(p.refund_amount ?? 0) > 0 && (
                <span className="text-[11px] text-muted-foreground">Refund: {formatCurrency(p.refund_amount!)}</span>
              )}
            </div>
          </div>

          {/* Staff notes */}
          {(isAdmin || p.staff_notes) && (
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
          )}
        </div>
      )}
    </div>
  );
}
