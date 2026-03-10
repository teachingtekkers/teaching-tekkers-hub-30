import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

export type SortField = "first_name" | "last_name" | "age";

interface Props {
  value: SortField;
  onChange: (v: SortField) => void;
}

const labels: Record<SortField, string> = {
  first_name: "First",
  last_name: "Surname",
  age: "Age",
};

export default function AttendanceSortControl({ value, onChange }: Props) {
  const fields: SortField[] = ["first_name", "last_name", "age"];
  const nextIdx = (fields.indexOf(value) + 1) % fields.length;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 text-xs h-7 text-muted-foreground"
      onClick={() => onChange(fields[nextIdx])}
    >
      <ArrowUpDown className="h-3 w-3" />
      {labels[value]}
    </Button>
  );
}
