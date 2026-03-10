import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check if any admin exists
  useEffect(() => {
    const checkSetup = async () => {
      const { data } = await supabase.rpc("get_user_role", { _user_id: "00000000-0000-0000-0000-000000000000" });
      // If this RPC works, the function exists. Check if any users are in user_roles.
      // We'll just try to fetch - if RLS blocks it, we show login. 
      // Better: use the setup-admin endpoint which checks internally.
      setCheckingSetup(false);
    };
    checkSetup();
  }, []);

  // Redirect if already logged in with a role
  useEffect(() => {
    if (user && role) {
      navigate(role === "head_coach" ? "/coach/my-camps" : "/dashboard", { replace: true });
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("setup-admin", {
      body: { email, password, full_name: setupName },
    });
    if (error || data?.error) {
      toast({ title: "Setup failed", description: error?.message || data?.error, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Admin created!", description: "Signing you in…" });
    // Now sign in
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      toast({ title: "Sign in failed", description: signInError.message, variant: "destructive" });
    }
  };

  if (authLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Trophy className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Teaching Tekkers</h1>
            <p className="text-sm text-muted-foreground mt-1">Operations Platform</p>
          </div>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardContent className="pt-6 pb-6 space-y-5">
            {setupMode ? (
              <form onSubmit={handleSetup} className="space-y-4">
                <p className="text-sm text-muted-foreground">Create the first admin account to get started.</p>
                <div className="space-y-2">
                  <Label htmlFor="setupName" className="text-sm font-medium">Full Name</Label>
                  <Input id="setupName" value={setupName} onChange={(e) => setSetupName(e.target.value)} required className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setupEmail" className="text-sm font-medium">Email</Label>
                  <Input id="setupEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setupPassword" className="text-sm font-medium">Password</Label>
                  <Input id="setupPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-10" />
                </div>
                <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
                  {loading ? "Setting up…" : "Create Admin Account"}
                </Button>
                <button type="button" onClick={() => setSetupMode(false)} className="w-full text-sm text-muted-foreground hover:text-foreground">
                  Back to login
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input id="email" type="email" placeholder="you@teachingtekkers.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" required />
                </div>
                <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
                <button type="button" onClick={() => setSetupMode(true)} className="w-full text-sm text-muted-foreground hover:text-foreground">
                  First time? Set up admin account
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          © {new Date().getFullYear()} Teaching Tekkers. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
