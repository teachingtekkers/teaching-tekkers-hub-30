import { useState } from "react";
import { Plus, Copy, MessageSquare, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { mockCamps, mockMessageTemplates } from "@/data/mock";
import { MessageTemplate, CampMessage } from "@/types";
import { toast } from "sonner";

const CATEGORIES = ["Reminder", "Update", "Info", "General"];

const CommunicationsPage = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>(mockMessageTemplates);
  const [messages, setMessages] = useState<CampMessage[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({ name: "", category: "General", message_text: "" });
  const [genForm, setGenForm] = useState({ camp_id: "", template_id: "" });

  const handleCreateTemplate = () => {
    if (!templateForm.name.trim() || !templateForm.message_text.trim()) {
      toast.error("Name and message text are required"); return;
    }
    const newTemplate: MessageTemplate = {
      id: String(templates.length + 1), ...templateForm, created_at: new Date().toISOString(),
    };
    setTemplates([...templates, newTemplate]);
    setCreateOpen(false);
    setTemplateForm({ name: "", category: "General", message_text: "" });
    toast.success("Template created");
  };

  const generateMessage = () => {
    if (!genForm.camp_id || !genForm.template_id) { toast.error("Select a camp and template"); return; }
    const camp = mockCamps.find(c => c.id === genForm.camp_id);
    const template = templates.find(t => t.id === genForm.template_id);
    if (!camp || !template) return;
    let text = template.message_text;
    text = text.replace(/\{\{camp_name\}\}/g, camp.name).replace(/\{\{club\}\}/g, camp.club_name)
      .replace(/\{\{venue\}\}/g, camp.venue).replace(/\{\{start_date\}\}/g, camp.start_date)
      .replace(/\{\{end_date\}\}/g, camp.end_date).replace(/\{\{start_time\}\}/g, camp.daily_start_time)
      .replace(/\{\{end_time\}\}/g, camp.daily_end_time).replace(/\{\{age_group\}\}/g, camp.age_group);
    const newMessage: CampMessage = {
      id: String(messages.length + 1), camp_id: genForm.camp_id, template_id: genForm.template_id,
      generated_text: text, created_at: new Date().toISOString(),
    };
    setMessages([...messages, newMessage]);
    setGenerateOpen(false);
    setGenForm({ camp_id: "", template_id: "" });
    toast.success("Message generated — ready to copy!");
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
          <p className="text-muted-foreground text-sm">Create templates and generate messages for WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button><Send className="mr-2 h-4 w-4" />Generate Message</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate Camp Message</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Camp</Label>
                  <Select value={genForm.camp_id} onValueChange={v => setGenForm({ ...genForm, camp_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                    <SelectContent>{mockCamps.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.club_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={genForm.template_id} onValueChange={v => setGenForm({ ...genForm, template_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                    <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {genForm.camp_id && genForm.template_id && (() => {
                  const camp = mockCamps.find(c => c.id === genForm.camp_id);
                  const template = templates.find(t => t.id === genForm.template_id);
                  if (!camp || !template) return null;
                  let preview = template.message_text
                    .replace(/\{\{camp_name\}\}/g, camp.name).replace(/\{\{club\}\}/g, camp.club_name)
                    .replace(/\{\{venue\}\}/g, camp.venue).replace(/\{\{start_date\}\}/g, camp.start_date)
                    .replace(/\{\{end_date\}\}/g, camp.end_date).replace(/\{\{start_time\}\}/g, camp.daily_start_time)
                    .replace(/\{\{end_time\}\}/g, camp.daily_end_time).replace(/\{\{age_group\}\}/g, camp.age_group);
                  return (
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="section-label mb-1">Preview</p>
                      <p className="text-sm">{preview}</p>
                    </div>
                  );
                })()}
                <Button onClick={generateMessage} className="w-full">Generate</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" />New Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Message Template</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. Camp Reminder" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={templateForm.category} onValueChange={v => setTemplateForm({ ...templateForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Message Text</Label>
                  <Textarea value={templateForm.message_text} onChange={e => setTemplateForm({ ...templateForm, message_text: e.target.value })} rows={4} placeholder="Use {{camp_name}}, {{club}}, {{venue}}, {{start_date}}, {{start_time}} as placeholders" />
                  <p className="text-xs text-muted-foreground">Variables: {"{{camp_name}}"}, {"{{club}}"}, {"{{venue}}"}, {"{{start_date}}"}, {"{{end_date}}"}, {"{{start_time}}"}, {"{{end_time}}"}, {"{{age_group}}"}</p>
                </div>
                <Button onClick={handleCreateTemplate} className="w-full">Create Template</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Templates" value={templates.length} icon={MessageSquare} />
        <StatCard label="Messages Generated" value={messages.length} icon={Send} />
      </div>

      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages">Generated Messages</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4 mt-4">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No messages generated yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Click "Generate Message" to create one</p>
              </CardContent>
            </Card>
          ) : (
            messages.slice().reverse().map(msg => {
              const camp = mockCamps.find(c => c.id === msg.camp_id);
              const template = templates.find(t => t.id === msg.template_id);
              return (
                <Card key={msg.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{camp?.name}</span>
                          {template && <Badge variant="outline" className="text-xs">{template.name}</Badge>}
                        </div>
                        <p className="text-sm bg-muted/30 rounded-lg p-3">{msg.generated_text}</p>
                        <p className="text-xs text-muted-foreground/60">{new Date(msg.created_at).toLocaleString()}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(msg.generated_text, msg.id)}>
                        {copiedId === msg.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No templates yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map(t => (
                <Card key={t.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{t.name}</h3>
                      <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{t.message_text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationsPage;
