import { useState } from "react";
import { mockCamps, mockBookings, mockPlayers, mockAttendance } from "@/data/mock";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Heart, Users, CheckCircle } from "lucide-react";
import { AttendanceRecord } from "@/types";

const AttendancePage = () => {
  const [selectedCamp, setSelectedCamp] = useState(mockCamps[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState("2026-03-09");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(mockAttendance);

  const campPlayers = mockBookings
    .filter(b => b.camp_id === selectedCamp)
    .map(b => mockPlayers.find(p => p.id === b.player_id)!)
    .filter(Boolean);

  const getStatus = (playerId: string) => {
    const record = attendance.find(
      a => a.camp_id === selectedCamp && a.player_id === playerId && a.date === selectedDate
    );
    return record?.status === 'present';
  };

  const toggleAttendance = (playerId: string) => {
    const existing = attendance.find(
      a => a.camp_id === selectedCamp && a.player_id === playerId && a.date === selectedDate
    );
    if (existing) {
      setAttendance(attendance.map(a =>
        a.id === existing.id ? { ...a, status: a.status === 'present' ? 'absent' : 'present' } : a
      ));
    } else {
      setAttendance([...attendance, {
        id: String(attendance.length + 1),
        camp_id: selectedCamp, player_id: playerId,
        date: selectedDate, status: 'present',
      }]);
    }
  };

  const camp = mockCamps.find(c => c.id === selectedCamp);
  const presentCount = campPlayers.filter(p => getStatus(p.id)).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1>Attendance</h1>
        <p>Mark daily attendance for camp players</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Camp</Label>
              <Select value={selectedCamp} onValueChange={setSelectedCamp}>
                <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                <SelectContent>
                  {mockCamps.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.club_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {camp && (
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{camp.name}</span>
              <span className="text-sm text-muted-foreground">• {selectedDate}</span>
            </div>
            <Badge variant={presentCount === campPlayers.length ? "default" : "secondary"} className="gap-1 text-xs">
              <CheckCircle className="h-3 w-3" />
              {presentCount}/{campPlayers.length}
            </Badge>
          </div>

          {campPlayers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No players booked for this camp.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {campPlayers.map(player => {
                const isPresent = getStatus(player.id);
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-colors ${
                      isPresent ? 'bg-[hsl(var(--success)/0.04)] border-[hsl(var(--success)/0.2)]' : 'bg-card hover:bg-accent/30'
                    }`}
                    onClick={() => toggleAttendance(player.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isPresent}
                        onCheckedChange={() => toggleAttendance(player.id)}
                        className="h-5 w-5"
                      />
                      <div>
                        <p className="font-medium text-sm">{player.first_name} {player.last_name}</p>
                        {player.medical_notes && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Heart className="h-3 w-3 text-destructive shrink-0" />
                            <p className="text-xs text-destructive">{player.medical_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={isPresent ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {isPresent ? "Present" : "Absent"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AttendancePage;
