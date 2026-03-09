import { useState } from "react";
import { Plus, FileDown, Eye, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { mockProposals } from "@/data/mock";
import { Proposal } from "@/types";
import { toast } from "sonner";
import jsPDF from "jspdf";

const ProposalsPage = () => {
  const [proposals, setProposals] = useState<Proposal[]>(mockProposals);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [form, setForm] = useState({ club_name: "", proposal_title: "", proposed_dates: "", camp_description: "", price_details: "", notes: "" });

  const handleCreate = () => {
    if (!form.club_name.trim() || !form.proposal_title.trim()) { toast.error("Club name and title are required"); return; }
    const newProposal: Proposal = {
      id: String(proposals.length + 1), club_name: form.club_name, proposal_title: form.proposal_title,
      proposed_dates: form.proposed_dates, camp_description: form.camp_description || null,
      price_details: form.price_details || null, status: "draft", notes: form.notes || null,
      created_at: new Date().toISOString(),
    };
    setProposals([...proposals, newProposal]);
    setCreateOpen(false);
    setForm({ club_name: "", proposal_title: "", proposed_dates: "", camp_description: "", price_details: "", notes: "" });
    toast.success("Proposal created");
  };

  const updateStatus = (id: string, status: Proposal["status"]) => {
    setProposals(proposals.map(p => p.id === id ? { ...p, status } : p));
  };

  const generatePDF = (proposal: Proposal) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(14, 93, 196); doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(24); doc.setFont("helvetica", "bold");
    doc.text("Teaching Tekkers", 20, 22);
    doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text("Football Coaching Company", 20, 32);
    doc.setTextColor(30, 30, 30); doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text(proposal.proposal_title, 20, 60);
    doc.setFontSize(14); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
    doc.text(`Prepared for: ${proposal.club_name}`, 20, 72);
    doc.setFontSize(10); doc.text(`Date: ${new Date(proposal.created_at).toLocaleDateString()}`, 20, 82);
    let y = 100;
    doc.setTextColor(30, 30, 30); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Proposed Dates", 20, y); y += 8;
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(proposal.proposed_dates, 20, y); y += 16;
    if (proposal.camp_description) {
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Camp Description", 20, y); y += 8;
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(proposal.camp_description, pageWidth - 40); doc.text(lines, 20, y); y += lines.length * 6 + 10;
    }
    if (proposal.price_details) {
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Pricing", 20, y); y += 8;
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(proposal.price_details, pageWidth - 40); doc.text(lines, 20, y); y += lines.length * 6 + 10;
    }
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(14, 93, 196); doc.setLineWidth(0.5); doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
    doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text("Teaching Tekkers • Football Coaching • Leinster, Ireland", 20, footerY);
    doc.text("www.teachingtekkers.com", pageWidth - 20, footerY, { align: "right" });
    doc.save(`${proposal.proposal_title.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF downloaded");
  };

  const statusBadge = (status: Proposal["status"]) => {
    switch (status) {
      case "draft": return <Badge variant="secondary">Draft</Badge>;
      case "sent": return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">Sent</Badge>;
      case "accepted": return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Accepted</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  const draftCount = proposals.filter(p => p.status === "draft").length;
  const sentCount = proposals.filter(p => p.status === "sent").length;
  const acceptedCount = proposals.filter(p => p.status === "accepted").length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground text-sm">Generate and track club camp proposals</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Proposal</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Proposal</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Club Name</Label><Input value={form.club_name} onChange={e => setForm({ ...form, club_name: e.target.value })} placeholder="e.g. Portmarnock AFC" /></div>
                <div className="space-y-2"><Label>Proposal Title</Label><Input value={form.proposal_title} onChange={e => setForm({ ...form, proposal_title: e.target.value })} placeholder="e.g. Summer Camp 2026" /></div>
              </div>
              <div className="space-y-2"><Label>Proposed Dates</Label><Input value={form.proposed_dates} onChange={e => setForm({ ...form, proposed_dates: e.target.value })} placeholder="e.g. 29 Jun – 3 Jul 2026" /></div>
              <div className="space-y-2"><Label>Camp Description</Label><Textarea value={form.camp_description} onChange={e => setForm({ ...form, camp_description: e.target.value })} rows={3} placeholder="Describe the camp offering..." /></div>
              <div className="space-y-2"><Label>Price Details</Label><Textarea value={form.price_details} onChange={e => setForm({ ...form, price_details: e.target.value })} rows={2} placeholder="e.g. €140 per child" /></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes (optional)" /></div>
              <Button onClick={handleCreate} className="w-full">Create Proposal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Proposals" value={proposals.length} icon={FileText} />
        <StatCard label="Drafts" value={draftCount} />
        <StatCard label="Sent" value={sentCount} />
        <StatCard label="Accepted" value={acceptedCount} />
      </div>

      {/* Mobile */}
      <div className="grid gap-4 sm:hidden">
        {proposals.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm">{p.proposal_title}</p>
                  <p className="text-sm text-muted-foreground">{p.club_name}</p>
                </div>
                {statusBadge(p.status)}
              </div>
              <p className="text-sm text-muted-foreground">{p.proposed_dates}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewProposal(p)}><Eye className="mr-1 h-3 w-3" />View</Button>
                <Button variant="outline" size="sm" onClick={() => generatePDF(p)}><FileDown className="mr-1 h-3 w-3" />PDF</Button>
                <Select value={p.status} onValueChange={v => updateStatus(p.id, v as Proposal["status"])}>
                  <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop */}
      <Card className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Club</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.proposal_title}</TableCell>
                <TableCell>{p.club_name}</TableCell>
                <TableCell>{p.proposed_dates}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewProposal(p)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => generatePDF(p)}><FileDown className="h-4 w-4" /></Button>
                    <Select value={p.status} onValueChange={v => updateStatus(p.id, v as Proposal["status"])}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* View dialog */}
      <Dialog open={!!viewProposal} onOpenChange={() => setViewProposal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewProposal && (
            <>
              <DialogHeader>
                <DialogTitle>{viewProposal.proposal_title}</DialogTitle>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline">{viewProposal.club_name}</Badge>
                  {statusBadge(viewProposal.status)}
                </div>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div><p className="section-label">Proposed Dates</p><p className="text-sm">{viewProposal.proposed_dates}</p></div>
                {viewProposal.camp_description && <div><p className="section-label">Description</p><p className="text-sm text-muted-foreground">{viewProposal.camp_description}</p></div>}
                {viewProposal.price_details && <div><p className="section-label">Pricing</p><p className="text-sm text-muted-foreground">{viewProposal.price_details}</p></div>}
                {viewProposal.notes && <div><p className="section-label">Notes</p><p className="text-sm text-muted-foreground">{viewProposal.notes}</p></div>}
                <Button onClick={() => generatePDF(viewProposal)} className="w-full"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProposalsPage;
