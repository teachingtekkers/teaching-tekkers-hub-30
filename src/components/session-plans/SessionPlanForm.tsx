import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export interface SessionFormValues {
  title: string;
  category_id: string;
  age_group: string;
  description: string;
  organisation: string;
  other_comments: string;
  coaching_points: string;
  player_numbers: string;
  equipment: string;
  content: string;
  diagram_image_url: string;
  video_url: string;
}

interface Category {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  initialValues?: Partial<SessionFormValues> & { id?: string };
  onSave: (values: SessionFormValues, id?: string) => Promise<void>;
  mode: "create" | "edit" | "duplicate";
}

const EMPTY: SessionFormValues = {
  title: "", category_id: "", age_group: "U8-U12", description: "",
  organisation: "", other_comments: "", coaching_points: "",
  player_numbers: "", equipment: "", content: "", diagram_image_url: "", video_url: "",
};

export default function SessionPlanForm({ open, onClose, categories, initialValues, onSave, mode }: Props) {
  const [form, setForm] = useState<SessionFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setForm({
          title: (mode === "duplicate" ? `${initialValues.title || ""} (Copy)` : initialValues.title) || "",
          category_id: initialValues.category_id || "",
          age_group: initialValues.age_group || "U8-U12",
          description: initialValues.description || "",
          organisation: initialValues.organisation || "",
          other_comments: initialValues.other_comments || "",
          coaching_points: initialValues.coaching_points || "",
          player_numbers: initialValues.player_numbers || "",
          equipment: initialValues.equipment || "",
          content: initialValues.content || "",
          diagram_image_url: initialValues.diagram_image_url || "",
          video_url: initialValues.video_url || "",
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, initialValues, mode]);

  const set = (key: keyof SessionFormValues, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.category_id) { toast.error("Category is required"); return; }
    setSaving(true);
    try {
      await onSave(form, mode === "edit" ? initialValues?.id : undefined);
      onClose();
    } catch {
      toast.error("Failed to save session plan");
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "create" ? "Create Session Plan" : mode === "edit" ? "Edit Session Plan" : "Duplicate Session Plan";

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Session Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. 1v1 Dribbling Gates" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category_id} onValueChange={v => set("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Age Group</Label>
              <Input value={form.age_group} onChange={e => set("age_group", e.target.value)} placeholder="e.g. U8-U12" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Player Numbers</Label>
              <Input value={form.player_numbers} onChange={e => set("player_numbers", e.target.value)} placeholder="e.g. 8-16" />
            </div>
            <div className="space-y-2">
              <Label>Equipment</Label>
              <Input value={form.equipment} onChange={e => set("equipment", e.target.value)} placeholder="e.g. Cones, bibs, balls" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Brief overview of the session" rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Organisation</Label>
            <Textarea value={form.organisation} onChange={e => set("organisation", e.target.value)} placeholder="How to set up and run the session" rows={4} />
          </div>

          <div className="space-y-2">
            <Label>Coaching Points</Label>
            <Textarea value={form.coaching_points} onChange={e => set("coaching_points", e.target.value)} placeholder="Key coaching points" rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Other Comments</Label>
            <Textarea value={form.other_comments} onChange={e => set("other_comments", e.target.value)} placeholder="Variations, progressions, notes" rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Diagram / Image URL</Label>
            <Input value={form.diagram_image_url} onChange={e => set("diagram_image_url", e.target.value)} placeholder="Paste image URL or leave blank" />
            <p className="text-[11px] text-muted-foreground">You can paste a link to a session diagram or uploaded image</p>
          </div>

          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input value={form.video_url} onChange={e => set("video_url", e.target.value)} placeholder="Paste video link or leave blank" />
            <p className="text-[11px] text-muted-foreground">Link to a session video (YouTube, Vimeo, etc.)</p>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={saving}>
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
