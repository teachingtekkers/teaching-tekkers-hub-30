import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campId: string;
  campName: string;
  date: string;
  onAdded: () => void;
}

const KIT_SIZES = ["YXS", "YS", "YM", "YL", "XS", "S", "M", "L", "XL"];

export default function AddWalkInDialog({ open, onOpenChange, campId, campName, date, onAdded }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    age: "",
    dob: "",
    parentName: "",
    parentPhone: "",
    emergencyContact: "",
    medicalNotes: "",
    photoPermission: true,
    kitSize: "M",
    paymentNotes: "",
  });

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Child name is required");
      return;
    }
    setSaving(true);

    try {
      // Create synced_booking record (walk-in) linked to this camp
      const { data: booking, error } = await supabase
        .from("synced_bookings")
        .insert({
          child_first_name: form.firstName.trim(),
          child_last_name: form.lastName.trim(),
          age: form.age ? parseInt(form.age) : null,
          date_of_birth: form.dob || null,
          parent_name: form.parentName.trim() || null,
          parent_phone: form.parentPhone.trim() || null,
          emergency_contact: form.emergencyContact.trim() || null,
          medical_notes: form.medicalNotes.trim() || null,
          photo_permission: form.photoPermission,
          kit_size: form.kitSize,
          matched_camp_id: campId,
          camp_name: campName,
          source_system: "walk-in",
          match_status: "matched",
          payment_status: "pending",
          staff_notes: form.paymentNotes.trim() || null,
          total_amount: 0,
          amount_paid: 0,
          amount_owed: 0,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Also mark present for today
      if (booking) {
        await supabase.from("attendance").insert({
          camp_id: campId,
          synced_booking_id: booking.id,
          date,
          status: "present",
        });
      }

      toast.success(`${form.firstName} ${form.lastName} added and marked present`);
      setForm({
        firstName: "", lastName: "", age: "", dob: "", parentName: "",
        parentPhone: "", emergencyContact: "", medicalNotes: "",
        photoPermission: true, kitSize: "M", paymentNotes: "",
      });
      onOpenChange(false);
      onAdded();
    } catch (err: any) {
      toast.error("Failed to add player: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Walk-In Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="First name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Last name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Age</Label>
              <Input type="number" value={form.age} onChange={e => update("age", e.target.value)} placeholder="e.g. 8" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date of Birth</Label>
              <Input type="date" value={form.dob} onChange={e => update("dob", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Parent / Guardian Name</Label>
            <Input value={form.parentName} onChange={e => update("parentName", e.target.value)} placeholder="Parent name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input type="tel" value={form.parentPhone} onChange={e => update("parentPhone", e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Emergency Contact</Label>
              <Input type="tel" value={form.emergencyContact} onChange={e => update("emergencyContact", e.target.value)} placeholder="Emergency phone" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Medical Notes</Label>
            <Textarea value={form.medicalNotes} onChange={e => update("medicalNotes", e.target.value)} placeholder="Any medical conditions or allergies" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kit Size</Label>
              <Select value={form.kitSize} onValueChange={v => update("kitSize", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIT_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Photo Permission</Label>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={form.photoPermission} onCheckedChange={v => update("photoPermission", v)} />
                <span className="text-xs text-muted-foreground">{form.photoPermission ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Payment Notes</Label>
            <Input value={form.paymentNotes} onChange={e => update("paymentNotes", e.target.value)} placeholder="e.g. Cash on day, to be invoiced" />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Adding…</> : "Add Player & Mark Present"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
