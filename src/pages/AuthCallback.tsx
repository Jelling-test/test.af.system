import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('=== AUTH CALLBACK START ===');
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Session:', session?.user?.email);
        
        if (sessionError) throw sessionError;
        
        if (!session) {
          console.error('No session found');
          toast.error("Login fejlede - ingen session fundet");
          navigate("/admin/login");
          return;
        }

        // Check if user has a role in user_roles table (for staff/admin)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        console.log('Role check:', { roleData, roleError });

        let roleName = roleData?.role || null;
        console.log('Role name:', roleName);

        // If no role found, check if user email is in invited staff
        if (!roleName) {
          console.log('No role found, checking for invitation...', session.user.email);
          const { data: invitedStaff, error: inviteError } = await (supabase as any)
            .from('plugin_data')
            .select('data')
            .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
            .eq('module', 'user_memberships')
            .eq('data->>email', session.user.email)
            .eq('data->>status', 'invited')
            .maybeSingle();

          console.log('Invitation check result:', { invitedStaff, inviteError });

          if (invitedStaff) {
            // Create user_roles entry for invited staff
            const invitedRole = invitedStaff.data.role;
            await supabase
              .from('user_roles')
              .insert({
                user_id: session.user.id,
                role: invitedRole,
              });

            // Update invitation status to active
            await (supabase as any)
              .from('plugin_data')
              .update({
                data: {
                  ...invitedStaff.data,
                  status: 'active',
                  user_id: session.user.id,
                  activated_at: new Date().toISOString(),
                },
              })
              .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
              .eq('module', 'user_memberships')
              .eq('data->>email', session.user.email);

            roleName = invitedRole;
            toast.success(`Velkommen! Du er nu aktiveret som ${invitedRole === 'admin' ? 'administrator' : 'medarbejder'}`);
          }
        }

        if (roleError) {
          console.error("Role check error:", roleError);
        }

        // Redirect based on role
        if (roleName === "admin") {
          navigate("/admin/dashboard");
        } else if (roleName === "staff") {
          navigate("/staff/dashboard");
        } else {
          // No role assigned yet - this is a new Google user
          toast.error("Din bruger er ikke tildelt en rolle endnu. Kontakt en administrator.");
          await supabase.auth.signOut();
          navigate("/staff/login");
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        toast.error(error.message || "Der opstod en fejl under login");
        navigate("/admin/login");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-muted-foreground">Logger ind...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
