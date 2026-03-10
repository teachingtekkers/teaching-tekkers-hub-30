import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { ParticipantData } from "./AttendanceParticipantRow";

interface Props {
  participants: ParticipantData[];
  getStatus: (id: string) => "present" | "absent";
  campName: string;
  selectedDate: string;
}

export default function AttendanceExport({ participants, getStatus, campName, selectedDate }: Props) {
  const handleExport = () => {
    const headers = ["Last Name", "First Name", "Age", "Status", "Kit Size", "Payment Status", "Amount Paid", "Amount Owed", "Parent Name", "Parent Phone", "Medical Notes"];
    const rows = participants.map((p) => [
      p.child_last_name,
      p.child_first_name,
      p.age ?? "",
      getStatus(p.id),
      p.kit_size ?? "",
      p.payment_status ?? "",
      p.amount_paid ?? 0,
      p.amount_owed ?? 0,
      p.parent_name ?? "",
      p.parent_phone ?? "",
      (p.medical_condition || p.medical_notes || "").replace(/,/g, ";"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }).replace(/ /g, "_");
    a.href = url;
    a.download = `Attendance_${campName.replace(/\s+/g, "_")}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (participants.length === 0) return null;

  return (
    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExport}>
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
