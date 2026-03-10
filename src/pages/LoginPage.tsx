import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, role } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }

    // Role will be loaded by AuthProvider; redirect happens via effect below
  };

  // Redirect once role is known after login
  const { user } = useAuth();
  if (user && role) {
    if (role === "head_coach") {
      navigate("/coach/my-camps", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Trophy className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Teaching Tekkers</h1>
            <p className="text-sm text-muted-foreground mt-1">Operations Platform</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-border/50">
          <CardContent className="pt-6 pb-6 space-y-5">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@teachingtekkers.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
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
