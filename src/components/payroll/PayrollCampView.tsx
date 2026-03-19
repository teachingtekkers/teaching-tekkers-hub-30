import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayrollCampEntry } from "@/pages/PayrollPage";

interface CampGroup {
  campId: string;
  campName: string;
  clubName: string;
  entries: (PayrollCampEntry & { coachName: string })[];
  campTotal: number;
}

interface Props {
  campGroups: CampGroup[];
}

export function PayrollCampView({ campGroups }: Props) {
  return (
    <div className="space-y-4">
      {campGroups.map(cg => (
        <Card key={cg.campId}>
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{cg.campName}</h3>
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
                <TableHead className="text-right">Fuel</TableHead>
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
                  <TableCell className="text-right font-mono">€{e.fuel.toFixed(2)}</TableCell>
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
