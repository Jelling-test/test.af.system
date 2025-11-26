import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Save,
  Eye,
  EyeOff,
  TestTube,
  AlertTriangle,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  Database,
  Mail,
  Zap,
  CreditCard,
  Settings,
  RotateCcw,
  History,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SystemSettings {
  campsite_name?: string;
  organization_type?: string;
  subscription_tier?: string;
  basis_pris?: number;
  low_power_threshold?: number;
  smtp_from?: string;
  smtp_from_name?: string;
  smtp_reply_to?: string;
  admin_email?: string;
  accounting_email?: string;
  stripe_publishable_key?: string;
  stripe_test_mode?: boolean;
}

const AdminIndstillinger = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({});
  const [settingsId, setSettingsId] = useState<string | null>(null);
  
  // UI states
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  
  // Email template states
  const [emailTemplates, setEmailTemplates] = useState<any>({
    koerende: { emne: '', besked: '', threshold_enheder: 2 },
    saeson: { emne: '', besked: '', threshold_enheder: 10 },
  });
  const [savingEmail, setSavingEmail] = useState(false);
  
  // System stats
  const [systemStats, setSystemStats] = useState({
    databaseSize: "N/A",
    totalRecords: 0,
    oldestRecord: "N/A",
    lastCleanup: "N/A",
  });
  
  // Meter restore states
  const [restoreDates, setRestoreDates] = useState<{snapshot_date: string, meter_count: number}[]>([]);
  const [selectedRestoreDate, setSelectedRestoreDate] = useState<string>("");
  const [restorePreview, setRestorePreview] = useState<{ieee_address: string, current_name: string, restore_name: string}[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSystemStats();
    fetchEmailTemplates();
    fetchRestoreDates();
  }, []);
  
  const fetchRestoreDates = async () => {
    try {
      const { data, error } = await (supabase as any).rpc('get_available_restore_dates');
      if (error) throw error;
      setRestoreDates(data || []);
    } catch (error) {
      console.error("Error fetching restore dates:", error);
    }
  };
  
  const fetchRestorePreview = async (date: string) => {
    setLoadingPreview(true);
    try {
      const { data, error } = await (supabase as any).rpc('preview_restore_from_snapshot', { p_date: date });
      if (error) throw error;
      setRestorePreview(data || []);
    } catch (error) {
      console.error("Error fetching restore preview:", error);
      toast.error("Fejl ved hentning af preview");
    } finally {
      setLoadingPreview(false);
    }
  };
  
  const handleRestore = async () => {
    if (!selectedRestoreDate) {
      toast.error("Vælg en dato først");
      return;
    }
    
    setRestoring(true);
    try {
      const { data, error } = await (supabase as any).rpc('restore_meter_names_from_snapshot', { p_date: selectedRestoreDate });
      if (error) throw error;
      
      const restoredCount = data?.length || 0;
      toast.success(`${restoredCount} målere genoprettet! MQTT rename kommandoer sendt.`);
      setRestorePreview([]);
      setSelectedRestoreDate("");
    } catch (error) {
      console.error("Error restoring meters:", error);
      toast.error("Fejl ved gendannelse af målere");
    } finally {
      setRestoring(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "system_settings")
        .eq("ref_id", "global")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings(data.data || {});
        setSettingsId(data.id);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Fejl ved hentning af indstillinger");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const { data: templates, error } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "email_templates")
        .in("ref_id", ["advarsel_koerende", "advarsel_saeson"]);

      if (error) throw error;

      const templatesObj: any = {
        koerende: { emne: '', besked: '', threshold_enheder: 2 },
        saeson: { emne: '', besked: '', threshold_enheder: 10 },
      };

      templates?.forEach((template: any) => {
        const type = template.ref_id === 'advarsel_koerende' ? 'koerende' : 'saeson';
        templatesObj[type] = {
          id: template.id,
          emne: template.data.emne || '',
          besked: template.data.besked || '',
          threshold_enheder: template.data.threshold_enheder || (type === 'koerende' ? 2 : 10),
        };
      });

      setEmailTemplates(templatesObj);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      toast.error("Fejl ved hentning af email templates");
    }
  };

  const fetchSystemStats = async () => {
    try {
      const { count, error } = await (supabase as any)
        .from("plugin_data")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

      if (error) throw error;

      const { data: oldestData } = await (supabase as any)
        .from("plugin_data")
        .select("created_at")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      setSystemStats({
        databaseSize: "N/A", // Would need database query for this
        totalRecords: count || 0,
        oldestRecord: oldestData?.created_at
          ? new Date(oldestData.created_at).toLocaleDateString("da-DK")
          : "N/A",
        lastCleanup: "Aldrig", // Would need to track this
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
    }
  };

  const saveEmailTemplate = async (type: 'koerende' | 'saeson') => {
    setSavingEmail(true);
    try {
      const template = emailTemplates[type];
      const refId = type === 'koerende' ? 'advarsel_koerende' : 'advarsel_saeson';
      
      const { error } = await (supabase as any)
        .from("plugin_data")
        .update({
          data: {
            navn: type === 'koerende' ? 'Advarselsmail - Kørende' : 'Advarselsmail - Sæson',
            type: refId,
            threshold_enheder: template.threshold_enheder,
            emne: template.emne,
            besked: template.besked,
          }
        })
        .eq("id", template.id);

      if (error) throw error;

      toast.success(`Email template for ${type} gemt`);
    } catch (error) {
      console.error("Error saving email template:", error);
      toast.error("Fejl ved gemning af email template");
    } finally {
      setSavingEmail(false);
    }
  };

  const saveSettings = async (section: string) => {
    setSaving(true);
    try {
      if (settingsId) {
        // Update existing
        const { error } = await (supabase as any)
          .from("plugin_data")
          .update({ data: settings })
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await (supabase as any)
          .from("plugin_data")
          .insert({
            organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            module: "system_settings",
            ref_id: "global",
            data: settings,
          })
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
      }

      toast.success(`${section} gemt`);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Fejl ved gemning af indstillinger");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      if (!settings.smtp_from) {
        toast.error("Udfyld afsender email først");
        return;
      }

      toast.info("Sender test email...");

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: "peter@jellingcamping.dk",
          subject: "Test email fra Jelling Power Hub",
          html: `
            <h1>Test Email</h1>
            <p>Dette er en test email fra Jelling Power Hub systemet.</p>
            <p><strong>Afsender:</strong> ${settings.smtp_from_name || "Jelling Camping"}</p>
            <p><strong>Email:</strong> ${settings.smtp_from}</p>
            <p><strong>Tidspunkt:</strong> ${new Date().toLocaleString("da-DK")}</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Hvis du har spørgsmål, svar på denne email eller kontakt os på ${settings.smtp_reply_to || settings.admin_email || "info@jellingcamping.dk"}
            </p>
          `,
          from_email: settings.smtp_from,
          from_name: settings.smtp_from_name || "Jelling Camping",
          reply_to: settings.smtp_reply_to || settings.admin_email,
        },
      });

      if (error) throw error;

      if (data?.message) {
        toast.success(data.message);
      } else {
        toast.success("Email gemt i kø - kan ses i databasen");
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Fejl ved afsendelse af test email: " + (error as Error).message);
    }
  };


  const handleSyncStripeProducts = async () => {
    try {
      // TODO: Call edge function to sync Stripe products
      toast.info("Stripe synkronisering ikke implementeret endnu");
    } catch (error) {
      console.error("Error syncing Stripe products:", error);
      toast.error("Fejl ved synkronisering af Stripe produkter");
    }
  };

  const handleClearHistory = async () => {
    try {
      // Delete old audit log entries
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await (supabase as any)
        .from("plugin_data")
        .delete()
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "audit_log")
        .lt("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      toast.success("Historik ryddet");
      setShowClearHistoryDialog(false);
      fetchSystemStats();
    } catch (error) {
      console.error("Error clearing history:", error);
      toast.error("Fejl ved rydning af historik");
    }
  };

  const handleExportData = async () => {
    try {
      // TODO: Implement data export
      toast.info("Data export funktionalitet ikke implementeret endnu");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Fejl ved eksport af data");
    }
  };

  const handleImportData = async () => {
    try {
      // TODO: Implement data import
      toast.info("Data import funktionalitet ikke implementeret endnu");
    } catch (error) {
      console.error("Error importing data:", error);
      toast.error("Fejl ved import af data");
    }
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
            <h1 className="text-lg sm:text-2xl font-bold ml-4">System Indstillinger</h1>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 space-y-4 sm:space-y-6 overflow-auto">
            {/* General Settings */}
            <Card className="animate-scale-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  <span>Generelle Indstillinger</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="campsite-name">Campingplads navn</Label>
                    <Input
                      id="campsite-name"
                      value={settings.campsite_name || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, campsite_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-type">Organisation type</Label>
                    <Input
                      id="org-type"
                      value={settings.organization_type || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, organization_type: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subscription-tier">Subscription tier (Kun læsning)</Label>
                    <Input
                      id="subscription-tier"
                      value={settings.subscription_tier || "Standard"}
                      disabled
                    />
                  </div>
                </div>
                <Button 
                  onClick={() => saveSettings("Generelle indstillinger")} 
                  disabled={saving}
                  className="min-h-[44px]"
                  aria-label="Gem generelle indstillinger"
                >
                  <Save className="mr-2 h-4 w-4" />
                  <span>Gem indstillinger</span>
                </Button>
              </CardContent>
            </Card>

            {/* Power Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Strøm Indstillinger
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basis-price">Basis pris per enhed (kr)</Label>
                    <Input
                      id="basis-price"
                      type="number"
                      step="0.1"
                      value={settings.basis_pris || 4.5}
                      onChange={(e) =>
                        setSettings({ ...settings, basis_pris: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low-threshold">Lav strøm threshold (enheder)</Label>
                    <Input
                      id="low-threshold"
                      type="number"
                      value={settings.low_power_threshold || 10}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          low_power_threshold: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <Button onClick={() => saveSettings("Strøm indstillinger")} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  Gem indstillinger
                </Button>
              </CardContent>
            </Card>

            {/* Email Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Indstillinger
                </CardTitle>
                <CardDescription>
                  Konfigurer email afsender. Systemet sender fra en no-reply adresse.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from">Afsender email (no-reply)</Label>
                    <Input
                      id="smtp-from"
                      type="email"
                      placeholder="noreply@jellingcamping.dk"
                      value={settings.smtp_from || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, smtp_from: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Denne email kan ikke modtage svar
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from-name">Afsender navn</Label>
                    <Input
                      id="smtp-from-name"
                      placeholder="Jelling Camping"
                      value={settings.smtp_from_name || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, smtp_from_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-reply-to">Svar til email (valgfri)</Label>
                    <Input
                      id="smtp-reply-to"
                      type="email"
                      placeholder="info@jellingcamping.dk"
                      value={settings.smtp_reply_to || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, smtp_reply_to: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Hvis kunden svarer, går det til denne email
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Administrator email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@jellingcamping.dk"
                      value={settings.admin_email || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, admin_email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accounting-email">Bogholderi email</Label>
                    <Input
                      id="accounting-email"
                      type="email"
                      placeholder="bogholderi@jellingcamping.dk"
                      value={settings.accounting_email || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, accounting_email: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveSettings("Email indstillinger")} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    Gem indstillinger
                  </Button>
                  <Button variant="outline" onClick={handleTestEmail}>
                    <TestTube className="mr-2 h-4 w-4" />
                    Send test email
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stripe Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Stripe
                </CardTitle>
                <CardDescription>
                  Stripe secret key gemmes sikkert i Lovable Cloud secrets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stripe-publishable">Publishable Key (Kun læsning)</Label>
                  <Input
                    id="stripe-publishable"
                    value={settings.stripe_publishable_key || "pk_test_..."}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Test mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Aktivér for at bruge Stripe test miljø
                    </p>
                  </div>
                  <Switch
                    checked={settings.stripe_test_mode || false}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, stripe_test_mode: checked })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveSettings("Stripe")} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    Gem indstillinger
                  </Button>
                  <Button variant="outline" onClick={handleSyncStripeProducts}>
                    Sync produkter
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Email Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Advarsels Email Templates
                </CardTitle>
                <CardDescription>
                  Konfigurer emails der sendes automatisk til kunder når deres pakke er ved at løbe tør.
                  Brug #navn# som placeholder for kundens navn.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Kørende Template */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold">Kørende Gæster</h3>
                  <p className="text-sm text-muted-foreground">
                    Sendes når der er {emailTemplates.koerende.threshold_enheder} enheder tilbage
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="koerende_emne">Email Emne</Label>
                      <Input
                        id="koerende_emne"
                        value={emailTemplates.koerende.emne}
                        onChange={(e) => setEmailTemplates({
                          ...emailTemplates,
                          koerende: { ...emailTemplates.koerende, emne: e.target.value }
                        })}
                        placeholder="Din strømpakke er næsten opbrugt"
                      />
                    </div>
                    <div>
                      <Label htmlFor="koerende_besked">Email Besked</Label>
                      <Textarea
                        id="koerende_besked"
                        value={emailTemplates.koerende.besked}
                        onChange={(e) => setEmailTemplates({
                          ...emailTemplates,
                          koerende: { ...emailTemplates.koerende, besked: e.target.value }
                        })}
                        placeholder="Hej #navn#&#10;&#10;Din strømpakke er næsten opbrugt..."
                        rows={6}
                      />
                    </div>
                    <Button 
                      onClick={() => saveEmailTemplate('koerende')} 
                      disabled={savingEmail}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Gem Kørende Template
                    </Button>
                  </div>
                </div>

                {/* Sæson Template */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold">Sæson Gæster</h3>
                  <p className="text-sm text-muted-foreground">
                    Sendes når der er {emailTemplates.saeson.threshold_enheder} enheder tilbage
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="saeson_emne">Email Emne</Label>
                      <Input
                        id="saeson_emne"
                        value={emailTemplates.saeson.emne}
                        onChange={(e) => setEmailTemplates({
                          ...emailTemplates,
                          saeson: { ...emailTemplates.saeson, emne: e.target.value }
                        })}
                        placeholder="Din strømpakke er næsten opbrugt"
                      />
                    </div>
                    <div>
                      <Label htmlFor="saeson_besked">Email Besked</Label>
                      <Textarea
                        id="saeson_besked"
                        value={emailTemplates.saeson.besked}
                        onChange={(e) => setEmailTemplates({
                          ...emailTemplates,
                          saeson: { ...emailTemplates.saeson, besked: e.target.value }
                        })}
                        placeholder="Hej #navn#&#10;&#10;Din strømpakke er næsten opbrugt..."
                        rows={6}
                      />
                    </div>
                    <Button 
                      onClick={() => saveEmailTemplate('saeson')} 
                      disabled={savingEmail}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Gem Sæson Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Database størrelse</p>
                    <p className="text-lg font-semibold">{systemStats.databaseSize}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total records</p>
                    <p className="text-lg font-semibold">{systemStats.totalRecords}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Ældste record</p>
                    <p className="text-lg font-semibold">{systemStats.oldestRecord}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Sidste cleanup</p>
                    <p className="text-lg font-semibold">{systemStats.lastCleanup}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meter Restore */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Gendan Måler-navne
                </CardTitle>
                <CardDescription>
                  Gendan måler-navne fra daglige snapshots. Bruges hvis NAS/Zigbee2MQTT mister konfiguration.
                  Systemet tager automatisk snapshot hver nat kl. 03:00 og gemmer 7 dages historik.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="restore-date">Vælg snapshot-dato</Label>
                    <Select 
                      value={selectedRestoreDate} 
                      onValueChange={(value) => {
                        setSelectedRestoreDate(value);
                        if (value) fetchRestorePreview(value);
                      }}
                    >
                      <SelectTrigger id="restore-date">
                        <SelectValue placeholder="Vælg dato..." />
                      </SelectTrigger>
                      <SelectContent>
                        {restoreDates.map((item) => (
                          <SelectItem key={item.snapshot_date} value={item.snapshot_date}>
                            {new Date(item.snapshot_date).toLocaleDateString('da-DK')} ({item.meter_count} målere)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleRestore} 
                      disabled={restoring || restorePreview.length === 0}
                      className="w-full sm:w-auto"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {restoring ? "Gendanner..." : "Gendan Navne"}
                    </Button>
                  </div>
                </div>
                
                {loadingPreview && (
                  <p className="text-sm text-muted-foreground">Indlæser preview...</p>
                )}
                
                {restorePreview.length > 0 && (
                  <div className="space-y-2">
                    <Label>Målere der vil blive ændret ({restorePreview.length} stk):</Label>
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-2">IEEE Adresse</th>
                            <th className="text-left p-2">Nuværende</th>
                            <th className="text-left p-2">→</th>
                            <th className="text-left p-2">Gendannes til</th>
                          </tr>
                        </thead>
                        <tbody>
                          {restorePreview.map((item) => (
                            <tr key={item.ieee_address} className="border-t">
                              <td className="p-2 font-mono text-xs">{item.ieee_address.substring(0, 12)}...</td>
                              <td className="p-2 text-destructive">{item.current_name}</td>
                              <td className="p-2">→</td>
                              <td className="p-2 text-green-600 font-medium">{item.restore_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {selectedRestoreDate && restorePreview.length === 0 && !loadingPreview && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Alle målere har korrekte navne - ingen ændringer nødvendige</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dangerous Actions */}
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Farlige Handlinger
                </CardTitle>
                <CardDescription>
                  Disse handlinger kan ikke fortrydes. Vær forsigtig!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => setShowClearHistoryDialog(true)}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Ryd al historik
                  </Button>
                  <Button variant="outline" onClick={handleExportData}>
                    <Download className="mr-2 h-4 w-4" />
                    Eksporter alle data
                  </Button>
                  <Button variant="outline" onClick={handleImportData}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importer data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {/* Clear History Confirmation */}
      <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Ryd al historik?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette alle audit log poster ældre end 30 dage. Denne handling kan ikke
              fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ryd historik
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default AdminIndstillinger;
