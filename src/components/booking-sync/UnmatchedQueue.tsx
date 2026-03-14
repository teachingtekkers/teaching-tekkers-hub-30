import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link2, PlusCircle, ChevronDown, ChevronRight } from "lucide-react";

interface SyncedBooking {
  id: string;
  camp_name: string;
  camp_date: string | null;
  venue: string | null;
  county: string | null;
  child_first_name: string;
  child_last_name: string;
  match_status: string;
  match_score: number | null;
  match_reason: string | null;
}

interface CampOption {
  id: string;
  name: string;
  venue: string;
  county: string;
  start_date: string;
  end_date: string;
}

interface UnmatchedGroup {
  key: string;
  camp_name: string;
  camp_date: string | null;
  venue: string | null;
  county: string | null;
  bookings: SyncedBooking[];
}

interface UnmatchedQueueProps {
  bookings: SyncedBooking[];
  onRefresh: () => void;
}

export default function UnmatchedQueue({ bookings, onRefresh }: UnmatchedQueueProps) {
  const { toast } = useToast();
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [selectedCamps, setSelectedCamps] = useState<Record<string, string>>({});
  const [selectedBookings, setSelectedBookings] = useState<Record<string, Set<string>>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("camps").select("id, name, venue, county, start_date, end_date").then(({ data }) => {
      if (data) setCamps(data as CampOption[]);
    });
  }, []);

  const unmatchedBookings = useMemo(
    () => bookings.filter((b) => b.match_status === "unmatched" || b.match_status === "needs_review"),
    [bookings]
  );

  const groups = useMemo<UnmatchedGroup[]>(() => {
    const map = new Map<string, UnmatchedGroup>();
    for (const b of unmatchedBookings) {
      const key = `${b.camp_name}||${b.camp_date || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          camp_name: b.camp_name,
          camp_date: b.camp_date,
          venue: b.venue,
          county: b.county,
          bookings: [],
        });
      }
      map.get(key)!.bookings.push(b);
    }
    return Array.from(map.values()).sort((a, b) => b.bookings.length - a.bookings.length);
  }, [unmatchedBookings]);

  const filteredCamps = (group: UnmatchedGroup): CampOption[] => {
    // Prefer camps with overlapping dates and same county, but show all
    return [...camps].sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (group.county) {
        if (a.county.toLowerCase() === group.county.toLowerCase()) scoreA += 10;
        if (b.county.toLowerCase() === group.county.toLowerCase()) scoreB += 10;
      }
      if (group.camp_date) {
        if (group.camp_date >= a.start_date && group.camp_date <= a.end_date) scoreA += 20;
        if (group.camp_date >= b.start_date && group.camp_date <= b.end_date) scoreB += 20;
      }
      // Name similarity bonus
      if (a.name.toLowerCase().includes(group.camp_name.toLowerCase().slice(0, 10))) scoreA += 5;
      if (b.name.toLowerCase().includes(group.camp_name.toLowerCase().slice(0, 10))) scoreB += 5;
      return scoreB - scoreA;
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleBooking = (groupKey: string, bookingId: string) => {
    setSelectedBookings((prev) => {
      const set = new Set(prev[groupKey] || []);
      set.has(bookingId) ? set.delete(bookingId) : set.add(bookingId);
      return { ...prev, [groupKey]: set };
    });
  };

  const handleLinkAll = async (group: UnmatchedGroup) => {
    const campId = selectedCamps[group.key];
    if (!campId) {
      toast({ title: "Select a camp first", variant: "destructive" });
      return;
    }
    setLinking(group.key);
    try {
      const ids = group.bookings.map((b) => b.id);
      const { error } = await supabase
        .from("synced_bookings")
        .update({ matched_camp_id: campId, match_status: "matched", manual_override: true } as any)
        .in("id", ids);
      if (error) throw error;
      toast({ title: "Linked", description: `${ids.length} bookings linked to camp` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Link failed", description: err.message, variant: "destructive" });
    } finally {
      setLinking(null);
    }
  };

  const handleLinkSelected = async (group: UnmatchedGroup) => {
    const campId = selectedCamps[group.key];
    const selected = selectedBookings[group.key];
    if (!campId) {
      toast({ title: "Select a camp first", variant: "destructive" });
      return;
    }
    if (!selected || selected.size === 0) {
      toast({ title: "Select bookings first", variant: "destructive" });
      return;
    }
    setLinking(group.key);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("synced_bookings")
        .update({ matched_camp_id: campId, match_status: "matched" } as any)
        .in("id", ids);
      if (error) throw error;
      toast({ title: "Linked", description: `${ids.length} selected bookings linked` });
      setSelectedBookings((prev) => ({ ...prev, [group.key]: new Set() }));
      onRefresh();
    } catch (err: any) {
      toast({ title: "Link failed", description: err.message, variant: "destructive" });
    } finally {
      setLinking(null);
    }
  };

  const handleCreateDraftCamp = async (group: UnmatchedGroup) => {
    setCreating(group.key);
    try {
      const startDate = group.camp_date || new Date().toISOString().split("T")[0];
      const endDateObj = new Date(startDate);
      endDateObj.setDate(endDateObj.getDate() + 3);
      const endDate = endDateObj.toISOString().split("T")[0];

      const clubName = group.camp_name.split(/[-–]/)[0].trim() || group.camp_name;

      const { data: newCamp, error: campErr } = await supabase
        .from("camps")
        .insert({
          name: group.camp_name,
          club_name: clubName,
          venue: group.venue || "TBC",
          county: group.county || "TBC",
          start_date: startDate,
          end_date: endDate,
          age_group: "U8-U12",
          status: "draft",
          is_auto_created: true,
        } as any)
        .select("id")
        .single();

      if (campErr) throw campErr;

      const ids = group.bookings.map((b) => b.id);
      const { error: linkErr } = await supabase
        .from("synced_bookings")
        .update({ matched_camp_id: newCamp.id, match_status: "matched" } as any)
        .in("id", ids);

      if (linkErr) throw linkErr;

      toast({ title: "Draft camp created", description: `"${group.camp_name}" created and ${ids.length} bookings linked` });
      onRefresh();
      // Refresh camps list
      const { data: refreshed } = await supabase.from("camps").select("id, name, venue, county, start_date, end_date");
      if (refreshed) setCamps(refreshed as CampOption[]);
    } catch (err: any) {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    } finally {
      setCreating(null);
    }
  };

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No unmatched or needs-review bookings. All bookings are linked to camps.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {unmatchedBookings.length} booking{unmatchedBookings.length !== 1 ? "s" : ""} across {groups.length} group{groups.length !== 1 ? "s" : ""} need attention.
      </p>

      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.key);
        const selected = selectedBookings[group.key] || new Set();
        const sortedCamps = filteredCamps(group);
        const isLinking = linking === group.key;
        const isCreating = creating === group.key;

        return (
          <Card key={group.key}>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleGroup(group.key)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-sm font-medium">{group.camp_name}</CardTitle>
                  {group.camp_date && (
                    <Badge variant="outline" className="text-xs font-normal">{group.camp_date}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {group.venue && <span className="text-xs text-muted-foreground hidden md:inline">{group.venue}</span>}
                  {group.county && <Badge variant="secondary" className="text-xs">{group.county}</Badge>}
                  <Badge className="bg-amber-100 text-amber-800 border-0">{group.bookings.length} bookings</Badge>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-3">
                {/* Camp selector + actions */}
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                  <div className="flex-1 w-full sm:max-w-xs">
                    <label className="text-xs text-muted-foreground mb-1 block">Link to existing camp</label>
                    <Select
                      value={selectedCamps[group.key] || ""}
                      onValueChange={(v) => setSelectedCamps((prev) => ({ ...prev, [group.key]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select a camp…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedCamps.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.name} — {c.venue} ({c.start_date})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!selectedCamps[group.key] || isLinking}
                      onClick={() => handleLinkAll(group)}
                      className="h-8 text-xs"
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      {isLinking ? "Linking…" : `Link All (${group.bookings.length})`}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!selectedCamps[group.key] || selected.size === 0 || isLinking}
                      onClick={() => handleLinkSelected(group)}
                      className="h-8 text-xs"
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Link Selected ({selected.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isCreating}
                      onClick={() => handleCreateDraftCamp(group)}
                      className="h-8 text-xs"
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      {isCreating ? "Creating…" : "Create Draft Camp"}
                    </Button>
                  </div>
                </div>

                {/* Bookings list */}
                <div className="border rounded-md divide-y max-h-64 overflow-auto">
                  {group.bookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/30">
                      <Checkbox
                        checked={selected.has(b.id)}
                        onCheckedChange={() => toggleBooking(group.key, b.id)}
                      />
                      <span className="font-medium flex-1">{b.child_first_name} {b.child_last_name}</span>
                      {b.match_status === "needs_review" && (
                        <Badge className="bg-blue-100 text-blue-800 border-0 text-[10px]">Review</Badge>
                      )}
                      {b.match_score != null && (
                        <span className="text-muted-foreground">score: {b.match_score}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
