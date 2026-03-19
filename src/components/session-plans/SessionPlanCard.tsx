import { BookOpen, Image } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SessionPlanCardProps {
  title: string;
  category: string;
  ageGroup: string;
  description?: string | null;
  diagramUrl?: string | null;
  onClick: () => void;
}

export default function SessionPlanCard({
  title, category, ageGroup, description, diagramUrl, onClick,
}: SessionPlanCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden"
      onClick={onClick}
    >
      {/* Diagram thumbnail area */}
      <div className="aspect-[16/9] bg-muted relative overflow-hidden">
        {diagramUrl ? (
          <img
            src={diagramUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <Badge className="absolute top-2 left-2 text-[10px] font-semibold bg-primary text-primary-foreground">
          {category}
        </Badge>
      </div>

      <CardContent className="p-3 space-y-1.5">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">{ageGroup}</Badge>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
