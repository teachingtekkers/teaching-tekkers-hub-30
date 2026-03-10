import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Shield } from "lucide-react";
import type { UserRole } from "@/types";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  coach_id: string | null;
  role: UserRole | null;
}

interface Coach {
  id: string;
  full_name: string;
}

export default function UserManagementPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("head_coach");

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (!profiles) return;

    // Fetch roles for each profile
    const usersWithRoles: UserProfile[] = [];
    for (const p of profiles) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", p.id)
        .limit(1)
        .single();
      usersWithRoles.push({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        coach_id: p.coach_id,
        role: (roleData?.role as UserRole) || null,
      });
    }
    setUsers(usersWithRoles);
  };

  const fetchCoaches = async () => {
    const { data } = await supabase.from("coaches").select("id, full_name");
    if (data) setCoaches(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchCoaches();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Create the user via edge function
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email: newEmail, password: newPassword, full_name: newName, role: newRole },
    });

    setLoading(false);

    if (error || data?.error) {
      toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
      return;
    }

    toast({ title: "User created", description: `${newName} added as ${newRole}` });
    setDialogOpen(false);
    setNewEmail("");
    setNewName("");
    setNewPassword("");
    setNewRole("head_coach");
    fetchUsers();
  };

  const handleAssignCoach = async (userId: string, coachId: string | null) => {
    const { error } = await supabase
      .from("profiles")
      .update({ coach_id: coachId === "none" ? null : coachId })
      .eq("id", userId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Coach profile linked" });
    fetchUsers();
  };

  const roleBadge = (role: UserRole | null) => {
    if (role === "admin") return <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>;
    if (role === "head_coach") return <Badge variant="outline">Head Coach</Badge>;
    return <Badge variant="secondary">No role</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage user accounts and roles</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="head_coach">Head Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating…" : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="stat-grid">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{users.filter((u) => u.role === "admin").length}</p>
            <p className="text-xs text-muted-foreground">Admins</p>
          </div>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Coach Profile</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{roleBadge(u.role)}</TableCell>
                <TableCell>
                  {u.role === "head_coach" ? (
                    <Select
                      value={u.coach_id || "none"}
                      onValueChange={(v) => handleAssignCoach(u.id, v)}
                    >
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="Link coach…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {coaches.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No users yet. Create the first user above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
