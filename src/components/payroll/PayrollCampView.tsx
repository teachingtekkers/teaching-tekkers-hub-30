import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayrollCampEntry } from "@/pages/PayrollPage";

interface CampGroup {
  campId: string;
  campName: string;
  clubName: string;
  entries: (PayrollCampEntry & { coachName: string; coachId: string })[];
  campTotal: number;
}

interface Props {
  campGroups: CampGroup[];
  onUpdateEntry?: (coachId: string, campId: string, field: "fuel" | "bonus" | "adjustment", value: number) => void;
}

export function PayrollCampView({ campGroups, onUpdateEntry }: Props) {
  return (
    <div className="space-y-4">
      {campGroups.map(cg => (
        <Card key={cg.campId}>
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <Link to={`/camps/${cg.campId}`} className="font-semibold hover:underline text-primary">{cg.campName}</Link>
              <p className="text-sm text-muted-foreground">{cg.clubName}</p>
            </div>
            <Badge variant="secondary" className="font-mono text-sm">€{cg.campTotal.toFixed(2)}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coach</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right w-28">Fuel (€)</TableHead>
                <TableHead className="text-right">Camp Bonus</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cg.entries.map(e => (
                <TableRow key={e.coachName}>
                  <TableCell className="font-medium">{e.coachName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={e.role === "head_coach" ? "default" : "secondary"} className="text-xs">
                      {e.role === "head_coach" ? "HC" : "Asst"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{e.daysWorked}</TableCell>
                  <TableCell className="text-right font-mono">€{e.dailyRate}</TableCell>
                  <TableCell className="text-right font-mono">€{e.basePay.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {onUpdateEntry ? (
                      <div className="relative inline-block">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 h-8 pl-5 pr-2 text-right font-mono border-primary/40 focus-visible:ring-primary"
                          value={e.fuel}
                          onChange={(ev) => onUpdateEntry(e.coachId, e.campId, "fuel", Number(ev.target.value) || 0)}
                        />
                      </div>
                    ) : (
                      <span className="font-mono">€{e.fuel.toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {e.campBonus > 0 ? (
                      <Badge variant="default" className="font-mono text-xs">€{e.campBonus.toFixed(2)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold font-mono">€{e.lineTotal.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
