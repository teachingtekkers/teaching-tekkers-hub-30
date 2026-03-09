import { useState } from "react";
import { Plus, Package, AlertTriangle, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { mockCamps, mockCoaches, mockEquipmentItems, mockEquipmentAssignments } from "@/data/mock";
import { EquipmentItem, EquipmentAssignment } from "@/types";
import { toast } from "sonner";

const CATEGORIES = ["Footballs", "Bibs", "Cones", "Kits", "Medals", "Trophies", "General"];

const EquipmentPage = () => {
  const [items, setItems] = useState<EquipmentItem[]>(mockEquipmentItems);
  const [assignments, setAssignments] = useState<EquipmentAssignment[]>(mockEquipmentAssignments);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", category: "General", total_quantity: 0, notes: "" });
  const [assignForm, setAssignForm] = useState({ equipment_item_id: "", camp_id: "", coach_id: "", quantity_out: 0, notes: "" });

  const handleAddItem = () => {
    if (!itemForm.name.trim()) { toast.error("Name is required"); return; }
    const newItem: EquipmentItem = {
      id: String(items.length + 1), name: itemForm.name, category: itemForm.category,
      total_quantity: itemForm.total_quantity, notes: itemForm.notes || null, created_at: new Date().toISOString(),
    };
    setItems([...items, newItem]);
    setAddItemOpen(false);
    setItemForm({ name: "", category: "General", total_quantity: 0, notes: "" });
    toast.success("Equipment added");
  };

  const handleAssign = () => {
    if (!assignForm.equipment_item_id || assignForm.quantity_out <= 0) { toast.error("Select item and quantity"); return; }
    const newAssignment: EquipmentAssignment = {
      id: String(assignments.length + 1), equipment_item_id: assignForm.equipment_item_id,
      camp_id: assignForm.camp_id || null, coach_id: assignForm.coach_id || null,
      quantity_out: assignForm.quantity_out, quantity_returned: 0, notes: assignForm.notes || null,
      created_at: new Date().toISOString(),
    };
    setAssignments([...assignments, newAssignment]);
    setAssignOpen(false);
    setAssignForm({ equipment_item_id: "", camp_id: "", coach_id: "", quantity_out: 0, notes: "" });
    toast.success("Equipment assigned");
  };

  const updateReturned = (id: string, value: number) => {
    setAssignments(assignments.map(a => a.id === id ? { ...a, quantity_returned: value } : a));
  };

  const getItemStats = (itemId: string) => {
    const itemAssignments = assignments.filter(a => a.equipment_item_id === itemId);
    const totalOut = itemAssignments.reduce((s, a) => s + a.quantity_out, 0);
    const totalReturned = itemAssignments.reduce((s, a) => s + a.quantity_returned, 0);
    return { totalOut, totalReturned, missing: totalOut - totalReturned };
  };

  const totalMissing = items.reduce((s, item) => s + getItemStats(item.id).missing, 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
          <p className="text-muted-foreground text-sm">Track and assign equipment for camps</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Package className="mr-2 h-4 w-4" />Assign</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Equipment</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Equipment Item</Label>
                  <Select value={assignForm.equipment_item_id} onValueChange={v => setAssignForm({ ...assignForm, equipment_item_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} (Stock: {i.total_quantity})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Camp (optional)</Label>
                  <Select value={assignForm.camp_id} onValueChange={v => setAssignForm({ ...assignForm, camp_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                    <SelectContent>{mockCamps.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Coach (optional)</Label>
                  <Select value={assignForm.coach_id} onValueChange={v => setAssignForm({ ...assignForm, coach_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select coach" /></SelectTrigger>
                    <SelectContent>{mockCoaches.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity Out</Label>
                  <Input type="number" value={assignForm.quantity_out} onChange={e => setAssignForm({ ...assignForm, quantity_out: Number(e.target.value) })} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })} placeholder="Optional" />
                </div>
                <Button onClick={handleAssign} className="w-full">Assign Equipment</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Equipment Item</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Size 4 Footballs" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={itemForm.category} onValueChange={v => setItemForm({ ...itemForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Quantity</Label>
                    <Input type="number" value={itemForm.total_quantity} onChange={e => setItemForm({ ...itemForm, total_quantity: Number(e.target.value) })} min={0} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={itemForm.notes} onChange={e => setItemForm({ ...itemForm, notes: e.target.value })} placeholder="Optional" />
                </div>
                <Button onClick={handleAddItem} className="w-full">Add Item</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Items" value={items.length} icon={Box} />
        <StatCard label="Active Assignments" value={assignments.filter(a => a.quantity_returned < a.quantity_out).length} icon={Package} />
        <StatCard label="Missing Items" value={totalMissing} icon={totalMissing > 0 ? AlertTriangle : Package} />
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          {/* Mobile */}
          <div className="grid gap-4 sm:hidden">
            {items.map(item => {
              const stats = getItemStats(item.id);
              return (
                <Card key={item.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{item.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">{item.category}</Badge>
                      </div>
                      <Badge variant="secondary">Stock: {item.total_quantity}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm text-center">
                      <div><span className="text-muted-foreground block text-xs">Out</span><strong>{stats.totalOut}</strong></div>
                      <div><span className="text-muted-foreground block text-xs">Returned</span><strong>{stats.totalReturned}</strong></div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Missing</span>
                        <strong className={stats.missing > 0 ? "text-destructive" : ""}>{stats.missing}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Missing</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const stats = getItemStats(item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                      <TableCell>{item.total_quantity}</TableCell>
                      <TableCell>{stats.totalOut}</TableCell>
                      <TableCell>{stats.totalReturned}</TableCell>
                      <TableCell>
                        <span className={stats.missing > 0 ? "text-destructive font-semibold" : ""}>
                          {stats.missing}{stats.missing > 0 && " ⚠"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.notes || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          {/* Mobile */}
          <div className="grid gap-4 sm:hidden">
            {assignments.map(a => {
              const item = items.find(i => i.id === a.equipment_item_id);
              const camp = mockCamps.find(c => c.id === a.camp_id);
              const coach = mockCoaches.find(c => c.id === a.coach_id);
              const missing = a.quantity_out - a.quantity_returned;
              return (
                <Card key={a.id}>
                  <CardContent className="p-4 space-y-2">
                    <p className="font-semibold text-sm">{item?.name}</p>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {camp && <p>Camp: {camp.name}</p>}
                      {coach && <p>Coach: {coach.full_name}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">Out: <strong>{a.quantity_out}</strong></span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">Returned:</span>
                        <Input type="number" className="w-16 h-8" value={a.quantity_returned} onChange={e => updateReturned(a.id, Number(e.target.value))} min={0} max={a.quantity_out} />
                      </div>
                      {missing > 0 ? <Badge variant="destructive">{missing} missing</Badge> : <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Complete</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Camp</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Missing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map(a => {
                  const item = items.find(i => i.id === a.equipment_item_id);
                  const camp = mockCamps.find(c => c.id === a.camp_id);
                  const coach = mockCoaches.find(c => c.id === a.coach_id);
                  const missing = a.quantity_out - a.quantity_returned;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{item?.name}</TableCell>
                      <TableCell>{camp?.name || "—"}</TableCell>
                      <TableCell>{coach?.full_name || "—"}</TableCell>
                      <TableCell>{a.quantity_out}</TableCell>
                      <TableCell>
                        <Input type="number" className="w-16 h-8" value={a.quantity_returned} onChange={e => updateReturned(a.id, Number(e.target.value))} min={0} max={a.quantity_out} />
                      </TableCell>
                      <TableCell className={missing > 0 ? "text-destructive font-semibold" : ""}>{missing}</TableCell>
                      <TableCell>
                        {missing === 0
                          ? <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Complete</Badge>
                          : <Badge variant="destructive">{missing} missing</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EquipmentPage;
