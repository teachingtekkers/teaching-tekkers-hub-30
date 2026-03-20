import { useState } from "react";
import ItineraryList from "@/components/itinerary/ItineraryList";
import ItineraryBuilder from "@/components/itinerary/ItineraryBuilder";
import ItineraryPrintView from "@/components/itinerary/ItineraryPrintView";

type View = "list" | "builder" | "print";

export default function ItinerariesPage() {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {view === "list" && (
        <ItineraryList
          onSelect={(id) => { setSelectedId(id); setView("builder"); }}
          onCreate={() => { setSelectedId(null); setView("builder"); }}
          onPrint={(id) => { setSelectedId(id); setView("print"); }}
        />
      )}
      {view === "builder" && (
        <ItineraryBuilder
          itineraryId={selectedId}
          onBack={() => setView("list")}
          onSaved={() => setView("list")}
        />
      )}
      {view === "print" && selectedId && (
        <ItineraryPrintView
          itineraryId={selectedId}
          onBack={() => setView("list")}
        />
      )}
    </div>
  );
}
