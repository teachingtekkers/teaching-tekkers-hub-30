import { X, Edit, Copy, Image, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface SessionPlanData {
  id: string;
  title: string;
  category_id: string | null;
  category_name: string;
  age_group: string;
  description: string | null;
  organisation: string | null;
  other_comments: string | null;
  coaching_points: string | null;
  player_numbers: string | null;
  equipment: string | null;
  content: string | null;
  diagram_image_url: string | null;
  created_at: string;
}

interface Props {
  plan: SessionPlanData | null;
  open: boolean;
  onClose: () => void;
  onEdit: (plan: SessionPlanData) => void;
  onDuplicate: (plan: SessionPlanData) => void;
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary mb-1">{label}</p>
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

export default function SessionPlanDetail({ plan, open, onClose, onEdit, onDuplicate }: Props) {
  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header bar */}
        <div className="bg-primary px-6 py-4 text-primary-foreground">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-[10px] font-semibold mb-1">
                {plan.category_name}
              </Badge>
              <h2 className="text-xl font-bold leading-tight">{plan.title}</h2>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] border-primary-foreground/30 text-primary-foreground/80">
                  {plan.age_group}
                </Badge>
                {plan.player_numbers && (
                  <span className="text-xs text-primary-foreground/70">
                    {plan.player_numbers} players
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="text-primary-foreground/80 hover:bg-primary-foreground/10 h-8 w-8"
                onClick={() => onEdit(plan)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-primary-foreground/80 hover:bg-primary-foreground/10 h-8 w-8"
                onClick={() => onDuplicate(plan)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Diagram area */}
        <div className="border-b">
          {plan.diagram_image_url ? (
            <img
              src={plan.diagram_image_url}
              alt={plan.title}
              className="w-full max-h-[350px] object-contain bg-muted"
            />
          ) : (
            <div className="h-48 bg-muted flex flex-col items-center justify-center gap-2">
              <Image className="h-12 w-12 text-muted-foreground/25" />
              <p className="text-xs text-muted-foreground/50">No diagram uploaded</p>
            </div>
          )}
        </div>

        {/* Content sections */}
        <div className="px-6 py-5 space-y-5">
          {plan.description && (
            <DetailSection label="Description">{plan.description}</DetailSection>
          )}

          {plan.organisation && (
            <DetailSection label="Organisation">{plan.organisation}</DetailSection>
          )}

          {plan.coaching_points && (
            <DetailSection label="Coaching Points">{plan.coaching_points}</DetailSection>
          )}

          {plan.other_comments && (
            <DetailSection label="Other Comments">{plan.other_comments}</DetailSection>
          )}

          {plan.equipment && (
            <DetailSection label="Equipment">{plan.equipment}</DetailSection>
          )}

          {plan.content && (
            <DetailSection label="Session Content">
              <div className="rounded-lg border p-4 bg-muted/30">
                <pre className="text-sm whitespace-pre-wrap font-sans">{plan.content}</pre>
              </div>
            </DetailSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
