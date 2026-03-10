import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  weekStart: Date;
  weekEnd: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export function RosterWeekSelector({ selectedDate, onDateChange, weekStart, weekEnd, onPrevWeek, onNextWeek }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="page-header !mb-0">
        <h1>Weekly Roster Generator</h1>
        <p>Week of {format(weekStart, "d MMM")} — {format(weekEnd, "d MMM yyyy")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal text-sm")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && onDateChange(d)} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={onNextWeek}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
