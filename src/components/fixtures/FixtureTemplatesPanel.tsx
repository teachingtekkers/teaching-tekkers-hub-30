import { useState, useEffect } from "react";
import { Save, FolderOpen, Copy, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Team {
  name: string;
  colour: string;
}

interface FixtureTemplate {
  id: string;
  name: string;
  teams: Team[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  currentTeams: Team[];
  onLoadTemplate: (teams: Team[]) => void;
}

export default function FixtureTemplatesPanel({ currentTeams, onLoadTemplate }: Props) {
  const [templates, setTemplates] = useState<FixtureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("fixture_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && data) {
      setTemplates(
        data.map((d) => ({
          ...d,
          teams: (d.teams as unknown as Team[]) || [],
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    if (!saveName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    const { error } = await supabase.from("fixture_templates").insert([{
      name: saveName.trim(),
      teams: JSON.parse(JSON.stringify(currentTeams)),
      notes: saveNotes.trim() || null,
    }]);
    if (error) {
      toast.error("Failed to save template");
      return;
    }
    toast.success("Template saved!");
    setSaveOpen(false);
    setSaveName("");
    setSaveNotes("");
    fetchTemplates();
  };

  const handleLoad = (t: FixtureTemplate) => {
    onLoadTemplate(t.teams);
    toast.success(`Loaded "${t.name}"`);
  };

  const handleDuplicate = async (t: FixtureTemplate) => {
    const { error } = await supabase.from("fixture_templates").insert({
      name: `${t.name} (copy)`,
      teams: t.teams as unknown as Record<string, unknown>[],
      notes: t.notes,
    });
    if (error) {
      toast.error("Failed to duplicate");
      return;
    }
    toast.success("Template duplicated!");
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("fixture_templates").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Template deleted");
    fetchTemplates();
  };

  const startRename = (t: FixtureTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const confirmRename = async () => {
    if (!editingId || !editName.trim()) return;
    const { error } = await supabase
      .from("fixture_templates")
      .update({ name: editName.trim(), updated_at: new Date().toISOString() })
      .eq("id", editingId);
    if (error) {
      toast.error("Failed to rename");
      return;
    }
    setEditingId(null);
    fetchTemplates();
  };

  const handleResave = async (t: FixtureTemplate) => {
    const { error } = await supabase
      .from("fixture_templates")
      .update({
        teams: currentTeams as unknown as Record<string, unknown>[],
        updated_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    if (error) {
      toast.error("Failed to update template");
      return;
    }
    toast.success(`Updated "${t.name}" with current teams`);
    fetchTemplates();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Saved Templates</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
              <Save className="mr-1 h-3 w-3" />Save Current
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No saved templates yet. Set up your teams and click "Save Current" to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border p-3 bg-muted/20">
                  <div className="flex-1 min-w-0">
                    {editingId === t.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={confirmRename}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.teams.length} teams · {t.teams.map((tm) => tm.name).join(", ")}
                        </p>
                        {t.notes && <p className="text-xs text-muted-foreground/70 mt-0.5">{t.notes}</p>}
                      </>
                    )}
                  </div>
                  {editingId !== t.id && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Load" onClick={() => handleLoad(t)}>
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Resave with current teams" onClick={() => handleResave(t)}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Rename" onClick={() => startRename(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Duplicate" onClick={() => handleDuplicate(t)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Template Name</Label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Easter Camp 4-Team"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                placeholder="Any notes about this setup…"
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Will save {currentTeams.length} teams: {currentTeams.map((t) => t.name).join(", ")}
            </p>
            <Button onClick={handleSave} className="w-full">Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
