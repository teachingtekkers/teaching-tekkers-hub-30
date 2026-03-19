import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayrollLine, PayrollCampEntry } from "@/pages/PayrollPage";

interface Props {
  coachSummaries: {
    coachId: string;
    coachName: string;
    entries: PayrollCampEntry[];
    totalPay: number;
    totalFuel: number;
    totalCampBonus: number;
    totalBonus: number;
    totalAdjustment: number;
    grandTotal: number;
  }[];
  onUpdateEntry: (coachId: string, campId: string, field: "fuel" | "bonus" | "adjustment", value: number) => void;
}

export function PayrollCoachView({ coachSummaries, onUpdateEntry }: Props) {
  return (
    <div className="space-y-4">
      {coachSummaries.map(cs => (
        <Card key={cs.coachId}>
          <div className="p-4 border-b flex items-center justify-between">
            <Link to={`/coaches/${cs.coachId}`} className="font-semibold hover:underline text-primary">{cs.coachName}</Link>
            <Badge variant="secondary" className="font-mono text-sm">€{cs.grandTotal.toFixed(2)}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camp</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right w-24">Fuel</TableHead>
                <TableHead className="text-right">Camp Bonus</TableHead>
                <TableHead className="text-right w-24">Manual Bonus</TableHead>
                <TableHead className="text-right w-24">Adj.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cs.entries.map(e => (
                <TableRow key={e.campId}>
                  <TableCell className="font-medium"><Link to={`/camps/${e.campId}`} className="hover:underline">{e.campName}</Link></TableCell>
                  <TableCell className="text-center">
                    <Badge variant={e.role === "head_coach" ? "default" : "secondary"} className="text-xs">
                      {e.role === "head_coach" ? "HC" : "Asst"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{e.daysWorked}</TableCell>
                  <TableCell className="text-right font-mono">€{e.dailyRate}</TableCell>
                  <TableCell className="text-right font-mono">€{e.basePay.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      className="w-20 h-8 text-right font-mono"
                      value={e.fuel}
                      onChange={(ev) => onUpdateEntry(cs.coachId, e.campId, "fuel", Number(ev.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {e.campBonus > 0 ? (
                      <Badge variant="default" className="font-mono text-xs">€{e.campBonus.toFixed(2)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      className="w-20 h-8 text-right font-mono"
                      value={e.bonus}
                      onChange={(ev) => onUpdateEntry(cs.coachId, e.campId, "bonus", Number(ev.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      className="w-20 h-8 text-right font-mono"
                      value={e.adjustment}
                      onChange={(ev) => onUpdateEntry(cs.coachId, e.campId, "adjustment", Number(ev.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold font-mono">€{e.lineTotal.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {cs.entries.length > 1 && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={4} className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-mono font-semibold">€{cs.totalPay.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">€{cs.totalFuel.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">€{cs.totalCampBonus.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">€{cs.totalBonus.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">€{cs.totalAdjustment.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">€{cs.grandTotal.toFixed(2)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
