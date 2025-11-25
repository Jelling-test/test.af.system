import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UserPlus,
  MoreVertical,
  Edit,
  Ban,
  CheckCircle,
  Trash2,
  ChevronDown,
  Shield,
  User,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { formatDanishDateTime } from "@/utils/dateTime";

interface StaffMember {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  status: string;
  last_login?: string;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  data: {
    action: string;
    user_email?: string;
    details?: string;
    timestamp: string;
  };
  created_at: string;
}

const AdminPersonale = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "admin">("staff");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState<"staff" | "admin">("staff");

  useEffect(() => {
    fetchStaff();
    fetchAuditLog();
  }, []);

  const fetchStaff = async () => {
    try {
      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .in("role", ["staff", "admin"]);

      if (rolesError) throw rolesError;

      // Fetch user details for each role
      const staffPromises = (rolesData || []).map(async (roleEntry) => {
        // Get user profile from profiles table
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("*")
          .eq("id", roleEntry.user_id)
          .maybeSingle();

        // Get last login from auth.users via RPC
        const { data: authData, error: authError } = await (supabase as any)
          .rpc('get_user_last_login', { user_id: roleEntry.user_id });
        
        if (authError) {
          console.error('Error fetching last login:', authError);
        }

        // Get membership status from plugin_data
        const { data: membershipData } = await (supabase as any)
          .from("plugin_data")
          .select("*")
          .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
          .eq("module", "user_memberships")
          .eq("ref_id", roleEntry.user_id)
          .maybeSingle();

        return {
          id: roleEntry.user_id,
          email: profile?.email || "N/A",
          full_name: membershipData?.data?.full_name || profile?.full_name || "N/A",
          role: roleEntry.role,
          status: membershipData?.data?.status || "active",
          last_login: authData?.[0]?.last_sign_in_at || null,
          created_at: roleEntry.created_at,
        };
      });

      const staffList = await Promise.all(staffPromises);
      setStaff(staffList.filter((s) => s.email !== "N/A"));
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Fejl ved hentning af personale");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "audit_log")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setAuditLog(data || []);
    } catch (error) {
      console.error("Error fetching audit log:", error);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !inviteFullName.trim()) {
      toast.error("Udfyld alle felter");
      return;
    }

    try {
      // Create invitation in plugin_data
      const userId = crypto.randomUUID();
      const { error: membershipError } = await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "user_memberships",
          key: userId,
          ref_id: userId,
          scope: "platform",
          data: {
            email: inviteEmail.trim(),
            full_name: inviteFullName.trim(),
            role: inviteRole,
            status: "invited",
            invited_at: new Date().toISOString(),
          },
        });

      if (membershipError) throw membershipError;

      // Log action
      const auditId = crypto.randomUUID();
      await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "audit_log",
          key: auditId,
          ref_id: auditId,
          scope: "platform",
          data: {
            action: "invite_user",
            user_email: inviteEmail.trim(),
            details: `Inviteret som ${inviteRole}`,
            timestamp: new Date().toISOString(),
          },
        });

      // Send invitation email via edge function
      const appUrl = window.location.origin; // Use current URL (localhost or production)
      const loginUrl = `${appUrl}/staff/login`;
      await supabase.functions.invoke("send-email", {
        body: {
          to: inviteEmail.trim(),
          subject: "Velkommen til Jelling Power Hub",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #3b82f6;">Velkommen til Jelling Power Hub</h1>
              <p>Hej ${inviteFullName.trim()},</p>
              <p>Du er blevet oprettet som <strong>${inviteRole === 'admin' ? 'Administrator' : 'Medarbejder'}</strong> i Jelling Power Hub systemet.</p>
              
              <h2 style="color: #1f2937; font-size: 18px;">Sådan logger du ind:</h2>
              <ol style="line-height: 1.8;">
                <li>Klik på knappen nedenfor</li>
                <li>Vælg <strong>"Personale login"</strong></li>
                <li>Log ind med din <strong>Google konto</strong> (${inviteEmail.trim()})</li>
              </ol>
              
              <p style="margin: 30px 0;">
                <a href="${loginUrl}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Log ind med Google</a>
              </p>
              
              <p style="color: #6b7280; font-size: 14px;">
                <strong>Vigtigt:</strong> Du skal bruge din Google konto med emailen <strong>${inviteEmail.trim()}</strong> for at få adgang.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="color: #6b7280; font-size: 12px;">
                Med venlig hilsen,<br>
                Jelling Camping<br>
                <a href="mailto:peter@jellingcamping.dk" style="color: #3b82f6;">peter@jellingcamping.dk</a>
              </p>
            </div>
          `,
          from_name: "Jelling Camping",
          reply_to: "peter@jellingcamping.dk",
        },
      });

      toast.success("Invitation sendt via email ✅");
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("staff");
      fetchStaff();
      fetchAuditLog();
    } catch (error) {
      console.error("Error inviting user:", error);
      toast.error("Fejl ved invitation af bruger");
    }
  };

  const handleEditRole = async () => {
    if (!selectedStaff) return;

    try {
      // Check if trying to demote the last admin
      const adminCount = staff.filter(s => s.role === "admin").length;
      if (selectedStaff.role === "admin" && editRole !== "admin" && adminCount <= 1) {
        toast.error("Kan ikke ændre den sidste administrator til staff!");
        return;
      }

      // Update role in user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: editRole })
        .eq("user_id", selectedStaff.id);

      if (roleError) throw roleError;

      // Update membership data
      await (supabase as any)
        .from("plugin_data")
        .update({
          data: {
            role: editRole,
          },
        })
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "user_memberships")
        .eq("ref_id", selectedStaff.id);

      // Log action
      const auditId = crypto.randomUUID();
      await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "audit_log",
          key: auditId,
          ref_id: auditId,
          scope: "platform",
          data: {
            action: "change_role",
            user_email: selectedStaff.email,
            details: `Rolle ændret til ${editRole}`,
            timestamp: new Date().toISOString(),
          },
        });

      toast.success("Rolle opdateret");
      setShowEditRoleModal(false);
      setSelectedStaff(null);
      fetchStaff();
      fetchAuditLog();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Fejl ved opdatering af rolle");
    }
  };

  const handleToggleStatus = async (member: StaffMember, newStatus: string) => {
    try {
      // Update status in membership
      await (supabase as any)
        .from("plugin_data")
        .update({
          data: {
            ...member,
            status: newStatus,
          },
        })
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "user_memberships")
        .eq("ref_id", member.id);

      // Log action
      const auditId = crypto.randomUUID();
      await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "audit_log",
          key: auditId,
          ref_id: auditId,
          scope: "platform",
          data: {
            action: newStatus === "active" ? "activate_user" : "deactivate_user",
            user_email: member.email,
            details: `Status ændret til ${newStatus}`,
            timestamp: new Date().toISOString(),
          },
        });

      toast.success(`Bruger ${newStatus === "active" ? "aktiveret" : "deaktiveret"}`);
      fetchStaff();
      fetchAuditLog();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Fejl ved ændring af status");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedStaff) return;

    try {
      // Check if this is the last admin
      const adminCount = staff.filter(s => s.role === "admin").length;
      if (selectedStaff.role === "admin" && adminCount <= 1) {
        toast.error("Kan ikke slette den sidste administrator!");
        return;
      }

      // Delete role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedStaff.id);

      if (roleError) throw roleError;

      // Delete membership
      await (supabase as any)
        .from("plugin_data")
        .delete()
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "user_memberships")
        .eq("ref_id", selectedStaff.id);

      // Log action
      const auditId = crypto.randomUUID();
      await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "audit_log",
          key: auditId,
          ref_id: auditId,
          scope: "platform",
          data: {
            action: "delete_user",
            user_email: selectedStaff.email,
            details: "Bruger slettet fra systemet",
            timestamp: new Date().toISOString(),
          },
        });

      toast.success("Bruger slettet");
      setShowDeleteDialog(false);
      setSelectedStaff(null);
      fetchStaff();
      fetchAuditLog();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Fejl ved sletning af bruger");
    }
  };

  const getRoleBadge = (role: string) => {
    return role === "admin" ? (
      <Badge variant="default" className="gap-1">
        <Shield className="h-3 w-3" />
        Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <User className="h-3 w-3" />
        Staff
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      active: { label: "Aktiv", variant: "default" },
      invited: { label: "Inviteret", variant: "outline" },
      disabled: { label: "Deaktiveret", variant: "destructive" },
    };

    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Indlæser...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full animate-fade-in">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 sm:h-16 border-b bg-background flex items-center px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <h1 className="text-lg sm:text-2xl font-bold ml-4">Personale</h1>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 space-y-4 sm:space-y-6 overflow-auto">
            {/* Staff Management */}
            <Card className="animate-scale-in">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Personale oversigt</CardTitle>
                    <CardDescription>Administrer adgang for personale og administratorer</CardDescription>
                  </div>
                  <Button onClick={() => setShowInviteModal(true)} className="min-h-[44px] w-full sm:w-auto">
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Inviter bruger</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sidste login</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Ingen personale fundet
                          </TableCell>
                        </TableRow>
                      ) : (
                        staff.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {member.full_name || "-"}
                            </TableCell>
                            <TableCell>{member.email}</TableCell>
                            <TableCell>{getRoleBadge(member.role)}</TableCell>
                            <TableCell>{getStatusBadge(member.status)}</TableCell>
                            <TableCell>
                              {member.last_login ? (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatDanishDateTime(member.last_login, {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-background z-50">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedStaff(member);
                                      setEditRole(member.role as "staff" | "admin");
                                      setShowEditRoleModal(true);
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Rediger rolle
                                  </DropdownMenuItem>
                                  {member.status === "active" ? (
                                    <DropdownMenuItem
                                      onClick={() => handleToggleStatus(member, "disabled")}
                                    >
                                      <Ban className="mr-2 h-4 w-4" />
                                      Deaktiver
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleToggleStatus(member, "active")}
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Genaktiver
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      // Check if this is the last admin
                                      const adminCount = staff.filter(s => s.role === "admin").length;
                                      if (member.role === "admin" && adminCount <= 1) {
                                        toast.error("Kan ikke slette den sidste administrator!");
                                        return;
                                      }
                                      setSelectedStaff(member);
                                      setShowDeleteDialog(true);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Slet bruger
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Audit Log */}
            <Card>
              <Collapsible open={auditLogOpen} onOpenChange={setAuditLogOpen}>
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                      <CardTitle>Aktivitetslog</CardTitle>
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${auditLogOpen ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CardDescription>Seneste handlinger udført af personale</CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-2">
                      {auditLog.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen aktivitet endnu</p>
                      ) : (
                        auditLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between p-3 border rounded-lg text-sm"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{entry.data.action.replace(/_/g, " ")}</p>
                              {entry.data.user_email && (
                                <p className="text-muted-foreground">Bruger: {entry.data.user_email}</p>
                              )}
                              {entry.data.details && (
                                <p className="text-muted-foreground">{entry.data.details}</p>
                              )}
                            </div>
                            <p className="text-muted-foreground text-xs whitespace-nowrap">
                              {formatDanishDateTime(entry.created_at, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </main>
        </div>
      </div>

      {/* Invite User Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Inviter ny bruger</DialogTitle>
            <DialogDescription>Send invitation til ny medarbejder</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="bruger@eksempel.dk"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Fulde navn</Label>
              <Input
                id="invite-name"
                placeholder="Fornavn Efternavn"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rolle</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as "staff" | "admin")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              En invitation email vil blive sendt til denne adresse (email funktionalitet skal
              implementeres)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleInviteUser}>Send invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={showEditRoleModal} onOpenChange={setShowEditRoleModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Rediger rolle</DialogTitle>
            <DialogDescription>
              Opdater rolle for {selectedStaff?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ny rolle</Label>
              <Select
                value={editRole}
                onValueChange={(value) => setEditRole(value as "staff" | "admin")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRoleModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleEditRole}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Slet bruger</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette {selectedStaff?.email}? Dette vil fjerne alle
              adgangsrettigheder og kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Slet bruger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default AdminPersonale;
