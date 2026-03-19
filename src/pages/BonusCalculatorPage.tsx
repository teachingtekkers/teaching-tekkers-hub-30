import { Calculator } from "lucide-react";

export default function BonusCalculatorPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bonus Calculator</h1>
          <p className="text-sm text-muted-foreground mt-1">Calculate and manage staff bonuses</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-4">
          <Calculator className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Coming Soon</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Bonus calculations will be available here.</p>
      </div>
    </div>
  );
}
