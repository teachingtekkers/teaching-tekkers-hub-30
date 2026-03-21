import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Car, Shield, Fuel, Upload, Trash2, FileText, AlertCircle, Tent, DollarSign, CalendarClock,
} from "lucide-react";

const COUNTIES = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway",
  "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford",
  "Louth", "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo",
  "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow",
];

function getAge(dob: string | null): number | null {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

interface CoachDoc {
  name: string;
  id: string;
  created_at: string;
}

interface CampAssignment {
  camp_id: string;
  camp_name: string;
  role: string;
  start_date: string;
  end_date: string;
}

export default function CoachDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", date_of_birth: "", phone: "", email: "",
    address: "", county: "", emergency_contact_name: "", emergency_contact_phone: "",
    can_drive: false, pickup_locations: [] as string[], preferred_counties: [] as string[],
    local_counties: [] as string[], is_head_coach: false,
    role_type: "assistant", daily_rate: 100, head_coach_daily_rate: 0,
    fuel_allowance_eligible: false, qualification_level: "",
    safeguarding_cert_expiry: "", first_aid_cert_expiry: "",
    pay_band_notes: "U18: €50/day = €200pw\n18: €57.50/day = €230pw\n19: €65/day = €260pw\n20+ / UEFA C: €71.25/day = €285pw\nUEFA B: €80/day = €320pw\nHead Coach below UEFA B: €80/day = €360pw\nHead Coach UEFA A/B: €100/day = €400pw", notes: "", status: "active",
  });

  // Temp inputs for array fields
  const [pickupInput, setPickupInput] = useState("");
  const [docs, setDocs] = useState<{ safeguarding: CoachDoc[]; first_aid: CoachDoc[]; other: CoachDoc[] }>({
    safeguarding: [], first_aid: [], other: [],
  });
  const [campAssignments, setCampAssignments] = useState<CampAssignment[]>([]);

  const fetchCoach = useCallback(async () => {
    if (isNew) return;
    const { data, error } = await supabase.from("coaches").select("*").eq("id", id!).single();
    if (error || !data) {
      toast({ title: "Coach not found", variant: "destructive" });
      navigate("/coaches");
      return;
    }
    setForm({
      full_name: data.full_name || "",
      date_of_birth: data.date_of_birth || "",
      phone: data.phone || "",
      email: data.email || "",
      address: (data as any).address || "",
      county: (data as any).county || "",
      emergency_contact_name: (data as any).emergency_contact_name || "",
      emergency_contact_phone: (data as any).emergency_contact_phone || "",
      can_drive: data.can_drive || false,
      pickup_locations: (data as any).pickup_locations || [],
      preferred_counties: (data as any).preferred_counties || [],
      local_counties: (data as any).local_counties || [],
      is_head_coach: data.is_head_coach || false,
      role_type: (data as any).role_type || "assistant",
      daily_rate: data.daily_rate || 100,
      head_coach_daily_rate: data.head_coach_daily_rate || 0,
      fuel_allowance_eligible: data.fuel_allowance_eligible || false,
      qualification_level: (data as any).qualification_level || "",
      safeguarding_cert_expiry: (data as any).safeguarding_cert_expiry || "",
      first_aid_cert_expiry: (data as any).first_aid_cert_expiry || "",
      pay_band_notes: (data as any).pay_band_notes || "U18: €50/day = €200pw\n18: €57.50/day = €230pw\n19: €65/day = €260pw\n20+ / UEFA C: €71.25/day = €285pw\nUEFA B: €80/day = €320pw\nHead Coach below UEFA B: €80/day = €360pw\nHead Coach UEFA A/B: €100/day = €400pw",
      notes: data.notes || "",
      status: (data as any).status || "active",
    });
    setLoading(false);
  }, [id, isNew, navigate, toast]);

  const fetchDocs = useCallback(async () => {
    if (isNew || !id) return;
    const categories = ["safeguarding", "first_aid", "other"] as const;
    const result: typeof docs = { safeguarding: [], first_aid: [], other: [] };
    for (const cat of categories) {
      const { data } = await supabase.storage.from("coach-documents").list(`${id}/${cat}`);
      if (data) {
        result[cat] = data.map(f => ({ name: f.name, id: f.id!, created_at: f.created_at! }));
      }
    }
    setDocs(result);
  }, [id, isNew]);

  const fetchCampAssignments = useCallback(async () => {
    if (isNew || !id) return;
    const { data } = await supabase.from("camp_coach_assignments").select("camp_id, role").eq("coach_id", id);
    if (data && data.length > 0) {
      const campIds = data.map((a: any) => a.camp_id);
      const { data: camps } = await supabase.from("camps").select("id, name, start_date, end_date").in("id", campIds);
      const campMap = new Map((camps || []).map((c: any) => [c.id, c]));
      setCampAssignments(data.map((a: any) => {
        const camp = campMap.get(a.camp_id);
        return {
          camp_id: a.camp_id,
          camp_name: camp?.name || "Unknown",
          role: a.role,
          start_date: camp?.start_date || "",
          end_date: camp?.end_date || "",
        };
      }).sort((a: CampAssignment, b: CampAssignment) => b.start_date.localeCompare(a.start_date)));
    }
  }, [id, isNew]);

  useEffect(() => { fetchCoach(); fetchDocs(); fetchCampAssignments(); }, [fetchCoach, fetchDocs, fetchCampAssignments]);

  const handleSave = async () => {
    setSaving(true);
    const payload: any = {
      full_name: form.full_name,
      phone: form.phone,
      email: form.email,
      date_of_birth: form.date_of_birth || null,
      address: form.address,
      county: form.county,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
      can_drive: form.can_drive,
      pickup_locations: form.pickup_locations,
      preferred_counties: form.preferred_counties,
      local_counties: form.local_counties,
      is_head_coach: form.role_type === "head_coach",
      role_type: form.role_type,
      daily_rate: form.daily_rate,
      head_coach_daily_rate: form.head_coach_daily_rate,
      fuel_allowance_eligible: form.fuel_allowance_eligible,
      qualification_level: form.qualification_level,
      safeguarding_cert_expiry: form.safeguarding_cert_expiry || null,
      first_aid_cert_expiry: form.first_aid_cert_expiry || null,
      pay_band_notes: form.pay_band_notes,
      notes: form.notes || null,
      status: form.status,
    };

    let error;
    if (isNew) {
      const { error: e } = await supabase.from("coaches").insert(payload);
      error = e;
    } else {
      const { error: e } = await supabase.from("coaches").update(payload).eq("id", id!);
      error = e;
    }

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isNew ? "Coach created" : "Coach updated" });
      if (isNew) navigate("/coaches");
    }
  };

  const handleUpload = async (category: string, files: FileList | null) => {
    if (!files || !id || isNew) return;
    for (const file of Array.from(files)) {
      const path = `${id}/${category}/${file.name}`;
      const { error } = await supabase.storage.from("coach-documents").upload(path, file, { upsert: true });
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      }
    }
    toast({ title: "Document uploaded" });
    fetchDocs();
  };

  const handleDeleteDoc = async (category: string, fileName: string) => {
    const path = `${id}/${category}/${fileName}`;
    await supabase.storage.from("coach-documents").remove([path]);
    toast({ title: "Document removed" });
    fetchDocs();
  };

  const addPickup = () => {
    if (pickupInput.trim()) {
      setForm({ ...form, pickup_locations: [...form.pickup_locations, pickupInput.trim()] });
      setPickupInput("");
    }
  };

  const removePickup = (idx: number) => {
    setForm({ ...form, pickup_locations: form.pickup_locations.filter((_, i) => i !== idx) });
  };

  const toggleArrayItem = (field: "preferred_counties" | "local_counties", county: string) => {
    const arr = form[field];
    setForm({
      ...form,
      [field]: arr.includes(county) ? arr.filter(c => c !== county) : [...arr, county],
    });
  };

  const age = getAge(form.date_of_birth);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <h3 className="section-label text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-6 first:mt-0">{children}</h3>
  );

  const DocSection = ({ label, category, files }: { label: string; category: string; files: CoachDoc[] }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {!isNew && (
          <label className="cursor-pointer">
            <input type="file" className="hidden" multiple onChange={e => handleUpload(category, e.target.files)} />
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
              <Upload className="h-3 w-3 mr-1" /> Upload
            </Badge>
          </label>
        )}
      </div>
      {files.length > 0 ? (
        <div className="space-y-1">
          {files.map(f => (
            <div key={f.name} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {f.name}
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteDoc(category, f.name)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{isNew ? "Save the coach first to upload documents." : "No documents uploaded."}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/coaches")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">{isNew ? "New Staff Member" : form.full_name}</h1>
            {!isNew && (
              <div className="flex items-center gap-2 mt-0.5">
                {age !== null && <span className="text-xs text-muted-foreground">Age: {age}</span>}
                <Badge className={form.status === "active" ? "text-[10px] bg-success/10 text-success border-success/20" : "text-[10px]"}>
                  {form.status}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <SectionLabel>Personal Information</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Full Name *</Label>
                  <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Date of Birth</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                    {age !== null && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {age}y
                        {age !== null && age >= 18 && age < 20 && (
                          <AlertCircle className="h-3 w-3 ml-1 text-warning" />
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Phone *</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Email *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-sm">Address</Label>
                  <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">County</Label>
                  <Select value={form.county} onValueChange={v => setForm({ ...form, county: v })}>
                    <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
                    <SelectContent>
                      {COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <SectionLabel>Emergency Contact</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Name</Label>
                  <Input value={form.emergency_contact_name} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Phone</Label>
                  <Input value={form.emergency_contact_phone} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transport & Pickup */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <SectionLabel>Transport & Pickup</SectionLabel>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Can Drive</Label>
                    <p className="text-xs text-muted-foreground">Can this coach drive to camps?</p>
                  </div>
                  <Switch checked={form.can_drive} onCheckedChange={v => setForm({ ...form, can_drive: v })} />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Fuel className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Fuel Allowance</Label>
                    <p className="text-xs text-muted-foreground">Eligible for fuel reimbursement</p>
                  </div>
                  <Switch checked={form.fuel_allowance_eligible} onCheckedChange={v => setForm({ ...form, fuel_allowance_eligible: v })} />
                </div>
              </div>

              {form.can_drive && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Pickup Locations</Label>
                    <p className="text-xs text-muted-foreground">Where can this coach collect other coaches from?</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a pickup location…"
                        value={pickupInput}
                        onChange={e => setPickupInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPickup())}
                        className="h-8"
                      />
                      <Button size="sm" variant="secondary" onClick={addPickup} className="h-8">Add</Button>
                    </div>
                    {form.pickup_locations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.pickup_locations.map((loc, i) => (
                          <Badge key={i} variant="secondary" className="text-xs pr-1">
                            {loc}
                            <button onClick={() => removePickup(i)} className="ml-1.5 hover:text-destructive">×</button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Preferred Counties</Label>
                <p className="text-xs text-muted-foreground">Counties this coach prefers to work in</p>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTIES.map(c => (
                    <Badge
                      key={c}
                      variant={form.preferred_counties.includes(c) ? "default" : "outline"}
                      className="text-xs cursor-pointer select-none"
                      onClick={() => toggleArrayItem("preferred_counties", c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Local Counties</Label>
                <p className="text-xs text-muted-foreground">Counties the coach considers local (no overnight needed)</p>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTIES.map(c => (
                    <Badge
                      key={c}
                      variant={form.local_counties.includes(c) ? "default" : "outline"}
                      className="text-xs cursor-pointer select-none"
                      onClick={() => toggleArrayItem("local_counties", c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role & Pay */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <SectionLabel>Role & Pay</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Role Type</Label>
                  <Select value={form.role_type} onValueChange={v => setForm({ ...form, role_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="head_coach">Head Coach</SelectItem>
                      <SelectItem value="assistant">Assistant</SelectItem>
                      <SelectItem value="helper">Helper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 self-end">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Head Coach Eligible</Label>
                  </div>
                  <Switch
                    checked={form.role_type === "head_coach"}
                    onCheckedChange={v => setForm({ ...form, role_type: v ? "head_coach" : "assistant" })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Default Daily Rate (€)</Label>
                  <Input type="number" value={form.daily_rate} onChange={e => setForm({ ...form, daily_rate: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Head Coach Daily Rate (€)</Label>
                  <Input type="number" value={form.head_coach_daily_rate} onChange={e => setForm({ ...form, head_coach_daily_rate: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Pay Band Notes</Label>
                <p className="text-xs text-muted-foreground">Age-based pay rules, upcoming rate changes, etc.</p>
                <Textarea value={form.pay_band_notes} onChange={e => setForm({ ...form, pay_band_notes: e.target.value })} rows={8} />
              </div>
              {age !== null && age < 20 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning-foreground">Age-Based Pay Notice</p>
                    <p className="text-xs text-muted-foreground">This coach is {age} years old. Review pay rate against age-based pay band rules.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Qualifications */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <SectionLabel>Qualifications & Certs</SectionLabel>
              <div className="space-y-1.5">
                <Label className="text-sm">Qualification Level</Label>
                <Input value={form.qualification_level} onChange={e => setForm({ ...form, qualification_level: e.target.value })} placeholder="e.g. FAI PDP1, UEFA B" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Safeguarding Cert Expiry</Label>
                <Input type="date" value={form.safeguarding_cert_expiry} onChange={e => setForm({ ...form, safeguarding_cert_expiry: e.target.value })} />
                {form.safeguarding_cert_expiry && new Date(form.safeguarding_cert_expiry) < new Date() && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Expired</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Garda Vetting Expiry</Label>
                <Input type="date" value={form.first_aid_cert_expiry} onChange={e => setForm({ ...form, first_aid_cert_expiry: e.target.value })} />
                {form.first_aid_cert_expiry && new Date(form.first_aid_cert_expiry) < new Date() && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Expired</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <SectionLabel>Documents</SectionLabel>
              <DocSection label="Safeguarding Certificate" category="safeguarding" files={docs.safeguarding} />
              <Separator />
              <DocSection label="Garda Vetting" category="first_aid" files={docs.first_aid} />
              <Separator />
              <DocSection label="ID / Other Documents" category="other" files={docs.other} />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <SectionLabel>Notes</SectionLabel>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={4} placeholder="General notes about this coach…" />
            </CardContent>
          </Card>

          {/* Camp Assignments */}
          {!isNew && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <SectionLabel>Camp Assignments</SectionLabel>
                {campAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No camp assignments found.</p>
                ) : (
                  <div className="space-y-2">
                    {campAssignments.map((a) => (
                      <Link key={a.camp_id} to={`/camps/${a.camp_id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors group">
                        <div className="flex items-center gap-2">
                          <Tent className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{a.camp_name}</p>
                            <p className="text-xs text-muted-foreground">{a.start_date} — {a.end_date}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{a.role === "head_coach" ? "Head Coach" : "Assistant"}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Link to="/roster"><Button variant="outline" size="sm" className="gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Roster</Button></Link>
                  <Link to="/payroll"><Button variant="outline" size="sm" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Payroll</Button></Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
