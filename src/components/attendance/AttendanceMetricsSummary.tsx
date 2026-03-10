import { Users, CheckCircle, XCircle, Banknote, AlertTriangle } from "lucide-react";
import type { ParticipantData } from "./AttendanceParticipantRow";

function calcTotalCost(p: ParticipantData): number {
  return Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
}

interface Props {
  participants: ParticipantData[];
  getStatus: (id: string) => "present" | "absent";
  campName?: string;
  selectedDate: string;
}

export default function AttendanceMetricsSummary({ participants, getStatus, campName, selectedDate }: Props) {
  const total = participants.length;
  const present = participants.filter((p) => getStatus(p.id) === "present").length;
  const absent = total - present;

  const paid = participants.filter((p) => {
    const owed = p.amount_owed ?? Math.max(0, calcTotalCost(p) - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
    return owed <= 0;
  }).length;
  const unpaid = total - paid;

  const outstanding = participants.reduce((sum, p) => {
    const owed = p.amount_owed ?? Math.max(0, calcTotalCost(p) - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
    return sum + Math.max(0, owed);
  }, 0);

  if (total === 0) return null;

  const formattedDate = (() => {
    try {
      return new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
    } catch { return selectedDate; }
  })();

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {campName && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{campName}</h3>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <Metric icon={Users} label="Registered" value={total} />
        <Metric icon={CheckCircle} label="Present" value={present} color="text-blue-600" />
        <Metric icon={XCircle} label="Absent" value={absent} color="text-muted-foreground" />
        <Metric icon={Banknote} label="Paid" value={paid} color="text-emerald-600" />
        <Metric icon={AlertTriangle} label="Unpaid" value={unpaid} color={unpaid > 0 ? "text-amber-600" : "text-muted-foreground"} />
        <div className="text-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Outstanding</span>
          <span className={`text-lg font-bold ${outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            €{outstanding.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{label}</span>
      <div className={`flex items-center justify-center gap-1 ${color || "text-foreground"}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-lg font-bold">{value}</span>
      </div>
    </div>
  );
}
