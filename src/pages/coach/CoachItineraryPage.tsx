import { FileCheck } from "lucide-react";

export default function CoachItineraryPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-foreground">Camp Itinerary</h1>
          <p className="text-sm text-muted-foreground mt-1">Daily schedule and activities for your camps</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-4">
          <FileCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Coming Soon</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Camp itinerary and daily schedules will appear here.</p>
      </div>
    </div>
  );
}
