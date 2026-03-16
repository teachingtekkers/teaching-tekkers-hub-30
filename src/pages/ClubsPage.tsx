import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Building2, Tent, Pencil, Trash2, Link2, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClubRow {
  id: string;
  name: string;
  county: string | null;
  created_at: string;
  camp_count: number;
}

interface CampRef {
  id: string;
  name: string;
  club_id: string | null;
  club_name: string;
  start_date: string;
}

export default function ClubsPage() {
  const { toast } = useToast();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [camps, setCamps] = useState<CampRef[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCounty, setFormCounty] = useState("");

  // Edit dialog
  const [editClub, setEditClub] = useState<ClubRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCounty, setEditCounty] = useState("");

  // Detail/link dialog
  const [detailClub, setDetailClub] = useState<ClubRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [clubsRes, campsRes] = await Promise.all([
      supabase.from("clubs").select("*").order("name"),
      supabase.from("camps").select("id, name, club_id, club_name, start_date").order("start_date", { ascending: false }),
    ]);

    const campsData = (campsRes.data || []) as CampRef[];
    const countMap: Record<string, number> = {};
    campsData.forEach(c => {
      if (c.club_id) countMap[c.club_id] = (countMap[c.club_id] || 0) + 1;
    });

    setClubs(
      (clubsRes.data || []).map((cl: any) => ({
        ...cl,
        camp_count: countMap[cl.id] || 0,
      }))
    );
    setCamps(campsData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("clubs").insert({
      name: formName.trim(),
      county: formCounty.trim() || null,
    });
    if (error) {
      toast({ title: "Error creating club", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Club created" });
      setCreateOpen(false);
      setFormName("");
      setFormCounty("");
      loadData();
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClub) return;
    const { error } = await supabase.from("clubs").update({
      name: editName.trim(),
      county: editCounty.trim() || null,
    }).eq("id", editClub.id);
    if (error) {
      toast({ title: "Error updating club", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Club updated" });
      setEditClub(null);
      loadData();
    }
  };

  const handleDelete = async (club: ClubRow) => {
    if (club.camp_count > 0) {
      toast({ title: "Cannot delete", description: "Unlink all camps first.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("clubs").delete().eq("id", club.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Club deleted" });
      loadData();
    }
  };

  const linkCamp = async (campId: string, clubId: string) => {
    const { error } = await supabase.from("camps").update({ club_id: clubId } as any).eq("id", campId);
    if (error) {
      toast({ title: "Link failed", description: error.message, variant: "destructive" });
    } else {
      loadData();
    }
  };

  const unlinkCamp = async (campId: string) => {
    const { error } = await supabase.from("camps").update({ club_id: null } as any).eq("id", campId);
    if (error) {
      toast({ title: "Unlink failed", description: error.message, variant: "destructive" });
    } else {
      loadData();
    }
  };

  const detailCamps = useMemo(() => {
    if (!detailClub) return [];
    return camps.filter(c => c.club_id === detailClub.id);
  }, [detailClub, camps]);

  const unlinkedCamps = useMemo(() => {
    return camps.filter(c => !c.club_id);
  }, [camps]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Clubs</h1>
          <p>Manage partner clubs and link them to camps</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> New Club</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Create Club</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Club Name</Label><Input value={formName} onChange={e => setFormName(e.target.value)} required /></div>
              <div className="space-y-1"><Label>County (optional)</Label><Input value={formCounty} onChange={e => setFormCounty(e.target.value)} /></div>
              <Button type="submit" className="w-full">Create Club</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="stat-grid">
        <StatCard title="Total Clubs" value={clubs.length} icon={Building2} />
        <StatCard title="Linked Camps" value={camps.filter(c => c.club_id).length} icon={Tent} />
        <StatCard title="Unlinked Camps" value={unlinkedCamps.length} icon={Unlink} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Club Name</TableHead>
                <TableHead>County</TableHead>
                <TableHead className="text-center">Linked Camps</TableHead>
                <TableHead className="w-[180px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clubs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No clubs yet. Create one to get started.</TableCell></TableRow>
              ) : clubs.map(club => (
                <TableRow key={club.id}>
                  <TableCell className="font-medium">{club.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{club.county || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{club.camp_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setDetailClub(club); }}>
                        <Link2 className="h-3.5 w-3.5 mr-1" /> Camps
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditClub(club); setEditName(club.name); setEditCounty(club.county || ""); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(club)} disabled={club.camp_count > 0}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editClub} onOpenChange={(o) => { if (!o) setEditClub(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Club</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1"><Label>Club Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required /></div>
            <div className="space-y-1"><Label>County</Label><Input value={editCounty} onChange={e => setEditCounty(e.target.value)} /></div>
            <Button type="submit" className="w-full">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail / Link-Unlink Dialog */}
      <Dialog open={!!detailClub} onOpenChange={(o) => { if (!o) setDetailClub(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailClub?.name} — Linked Camps</DialogTitle>
            <DialogDescription>Manage which camps are linked to this club.</DialogDescription>
          </DialogHeader>

          {detailCamps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Linked</p>
              {detailCamps.map(c => (
                <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.start_date} · {c.club_name}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive h-7 text-xs" onClick={() => unlinkCamp(c.id)}>
                    <Unlink className="h-3 w-3 mr-1" /> Unlink
                  </Button>
                </div>
              ))}
            </div>
          )}

          {unlinkedCamps.length > 0 && (
            <div className="space-y-1 mt-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Unlinked Camps</p>
              {unlinkedCamps.map(c => (
                <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.start_date} · {c.club_name}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => linkCamp(c.id, detailClub!.id)}>
                    <Link2 className="h-3 w-3 mr-1" /> Link
                  </Button>
                </div>
              ))}
            </div>
          )}

          {detailCamps.length === 0 && unlinkedCamps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No camps available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
