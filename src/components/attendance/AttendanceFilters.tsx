import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AttendanceFilterState {
  search: string;
  paymentFilter: "all" | "unpaid" | "paid";
  statusFilter: "all" | "present" | "absent";
}

interface Props {
  filters: AttendanceFilterState;
  onChange: (filters: AttendanceFilterState) => void;
}

export default function AttendanceFilters({ filters, onChange }: Props) {
  const hasFilters = filters.search || filters.paymentFilter !== "all" || filters.statusFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          className="h-8 pl-8 text-xs"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <Select value={filters.paymentFilter} onValueChange={(v) => onChange({ ...filters, paymentFilter: v as any })}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All payments</SelectItem>
          <SelectItem value="unpaid">Unpaid only</SelectItem>
          <SelectItem value="paid">Paid only</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.statusFilter} onValueChange={(v) => onChange({ ...filters, statusFilter: v as any })}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          <SelectItem value="present">Present</SelectItem>
          <SelectItem value="absent">Absent</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => onChange({ search: "", paymentFilter: "all", statusFilter: "all" })}>
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}
