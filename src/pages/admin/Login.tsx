import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Zap, Mail } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin/dashboard`,
        },
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Google login fejlede");
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (!email.trim() || !password.trim()) {
      setErrors({
        email: !email.trim() ? "Email er påkrævet" : undefined,
        password: !password.trim() ? "Adgangskode er påkrævet" : undefined,
      });
      return;
    }

    setLoading(true);

    try {
      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      // Get user membership
      const { data: membershipData, error: membershipError } = await (supabase as any)
        .from("user_memberships")
        .select("role_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (membershipError || !membershipData) {
        await supabase.auth.signOut();
        toast.error("Du har ikke administrator rettigheder");
        setLoading(false);
        return;
      }

      // Get role name
      const { data: roleData, error: roleError } = await (supabase as any)
        .from("roles")
        .select("name")
        .eq("id", (membershipData as any).role_id)
        .single();

      if (roleError || !roleData) {
        await supabase.auth.signOut();
        toast.error("Du har ikke administrator rettigheder");
        setLoading(false);
        return;
      }

      const roleName = (roleData as any).name;
      if (roleName !== "admin" && roleName !== "superadmin") {
        await supabase.auth.signOut();
        toast.error("Du har ikke administrator rettigheder");
        setLoading(false);
        return;
      }

      toast.success("Login succesfuldt");
      navigate("/admin/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Login fejlede");
      setErrors({ email: "Ugyldigt email eller adgangskode" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4 animate-fade-in">
      <Card className="w-full max-w-md animate-scale-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-10 w-10 text-primary" />
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Administrator Login</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Log ind på admin panelet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 mb-4"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <Mail className="mr-2 h-5 w-5" />
            Log ind med Google
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Eller</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@email.dk"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({});
                }}
                disabled={loading}
                required
                className="h-11"
                aria-label="Email adresse"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-sm text-destructive animate-fade-in">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base">Adgangskode</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors({});
                }}
                disabled={loading}
                required
                className="h-11"
                aria-label="Adgangskode"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-destructive animate-fade-in">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              size="lg"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span>Logger ind...</span>
                </div>
              ) : (
                "Log ind"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => navigate("/staff/login")}
              className="text-sm hover-scale"
            >
              Personale login →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
