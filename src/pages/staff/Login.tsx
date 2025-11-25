import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Zap, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Ugyldig email adresse" }),
  password: z.string().min(6, { message: "Adgangskode skal være mindst 6 tegn" }),
});

const StaffLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google login fejlede",
        description: error.message || "Der opstod en fejl",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: any = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0]] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Login fejlede");
      }

      // Check user role in user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      const roleName = roleData?.role;
      if (!roleData || (roleName !== "staff" && roleName !== "admin")) {
        await supabase.auth.signOut();
        throw new Error("Du har ikke adgang til personalepanelet");
      }

      toast({
        title: "Login succesfuld",
        description: `Velkommen tilbage, ${data.user.email}`,
      });

      navigate("/staff/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login fejlede",
        description: error.message || "Ugyldigt email eller adgangskode",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4 animate-fade-in">
      <Card className="w-full max-w-md animate-scale-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-10 w-10 text-primary" />
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Personale Login</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Log ind på personalepanelet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 mb-4"
            onClick={handleGoogleLogin}
            disabled={isLoading}
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
                placeholder="din@email.dk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
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
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
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
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
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
              onClick={() => navigate("/")}
              className="text-sm hover-scale"
            >
              Tilbage til gæsteportal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLogin;
