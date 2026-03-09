import { LucideIcon, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: string;
  variant?: "default" | "success" | "warning" | "destructive";
}

export function StatCard({ title, label, value, icon: Icon, description, trend, variant = "default" }: StatCardProps) {
  const displayTitle = title || label || "";
  const DisplayIcon = Icon || Activity;

  const iconBg = {
    default: "bg-accent text-primary",
    success: "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]",
    warning: "bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]",
    destructive: "bg-destructive/10 text-destructive",
  }[variant];

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{displayTitle}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {trend && <p className="text-xs font-medium text-[hsl(var(--success))]">{trend}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
            <DisplayIcon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
