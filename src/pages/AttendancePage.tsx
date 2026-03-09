import { useState } from "react";
import { mockCamps, mockBookings, mockPlayers, mockAttendance } from "@/data/mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
        a.id === existing.id
          ? { ...a, status: a.status === 'present' ? 'absent' : 'present' }
          : a
      ));
    } else {
      setAttendance([...attendance, {
        id: String(attendance.length + 1),
        camp_id: selectedCamp,
        player_id: playerId,
        date: selectedDate,
        status: 'present',
      }]);
    }
  };

  const camp = mockCamps.find(c => c.id === selectedCamp);
  const presentCount = campPlayers.filter(p => getStatus(p.id)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">Mark daily attendance for camp players</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Camp</Label>
              <Select value={selectedCamp} onValueChange={setSelectedCamp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select camp" />
                </SelectTrigger>
                <SelectContent>
                  {mockCamps.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {camp && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{camp.name} — {selectedDate}</CardTitle>
              <Badge variant="secondary">{presentCount}/{campPlayers.length} present</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {campPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No players booked for this camp.</p>
            ) : (
              <div className="divide-y">
                {campPlayers.map(player => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between py-3 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2"
                    onClick={() => toggleAttendance(player.id)}
                  >
                    <div>
                      <p className="font-medium">{player.first_name} {player.last_name}</p>
                      {player.medical_notes && (
                        <p className="text-xs text-destructive">⚕ {player.medical_notes}</p>
                      )}
                    </div>
                    <Checkbox
                      checked={getStatus(player.id)}
                      onCheckedChange={() => toggleAttendance(player.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendancePage;
