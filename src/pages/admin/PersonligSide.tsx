import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Smartphone,
  Mail,
  Link,
  Copy,
  ExternalLink,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Croissant,
  Info,
  Search,
  FileText,
  Clock,
  Send,
  Eye,
  Power,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";

interface Customer {
  booking_id: number;
  first_name: string;
  last_name: string;
  email: string;
  magic_token: string | null;
  arrival_date: string;
  departure_date: string;
}

interface PortalInfo {
  id: string;
  key: string;
  title: string;
  content: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

interface BakeryProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  is_available: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject_da: string;
  subject_en: string | null;
  subject_de: string | null;
  body_html: string;
  trigger_days_before: number | null;
  is_active: boolean;
  priority: number;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  template_name: string;
  booking_id: number;
  status: string;
  sent_at: string;
}

const PersonligSide = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [portalInfo, setPortalInfo] = useState<PortalInfo[]>([]);
  const [bakeryProducts, setBakeryProducts] = useState<BakeryProduct[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingToken, setGeneratingToken] = useState<number | null>(null);
  const [sendingEmail, setSendingEmail] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [editTriggerDays, setEditTriggerDays] = useState<string>("");
  const [editSubject, setEditSubject] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Hent kunder med magic tokens
      const { data: regular } = await supabase
        .from('regular_customers')
        .select('booking_id, first_name, last_name, email, magic_token, arrival_date, departure_date')
        .order('booking_id', { ascending: false })
        .limit(50);

      const { data: seasonal } = await supabase
        .from('seasonal_customers')
        .select('booking_id, first_name, last_name, email, magic_token, arrival_date, departure_date')
        .order('booking_id', { ascending: false })
        .limit(50);

      setCustomers([...(regular || []), ...(seasonal || [])]);

      // Hent portal info
      const { data: info } = await supabase
        .from('portal_info')
        .select('*')
        .order('sort_order', { ascending: true });
      setPortalInfo(info || []);

      // Hent bageri produkter
      const { data: products } = await supabase
        .from('bakery_products')
        .select('*')
        .order('sort_order', { ascending: true });
      setBakeryProducts(products || []);

      // Hent email templates
      const { data: templates } = await supabase
        .from('email_templates')
        .select('*')
        .order('priority', { ascending: true });
      setEmailTemplates(templates || []);

      // Hent email logs (sidste 50)
      const { data: logs } = await supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);
      setEmailLogs(logs || []);

    } catch (error) {
      console.error('Fejl ved hentning af data:', error);
      toast.error('Kunne ikke hente data');
    }
    setLoading(false);
  };

  const generateMagicToken = async (bookingId: number) => {
    setGeneratingToken(bookingId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-magic-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Magic link genereret for ${data.customer_name}`);
        fetchData(); // Opdater listen
      } else {
        toast.error(data.error || 'Kunne ikke generere token');
      }
    } catch (error) {
      toast.error('Fejl ved generering af token');
    }
    setGeneratingToken(null);
  };

  const copyMagicLink = (bookingId: number, token: string) => {
    const link = `https://jelling.vercel.app/m/${bookingId}/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Magic link kopieret til udklipsholder');
  };

  const sendWelcomeEmail = async (bookingId: number) => {
    setSendingEmail(bookingId);
    try {
      const response = await fetch(
        'https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/send-welcome-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId }),
        }
      );
      const data = await response.json();
      if (data.success) {
        toast.success(`Email sendt til ${data.email}`);
      } else {
        toast.error(data.error || 'Kunne ikke sende email');
      }
    } catch (error) {
      toast.error('Fejl ved afsendelse af email');
    }
    setSendingEmail(null);
  };

  const filteredCustomers = customers.filter(c =>
    c.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.booking_id?.toString().includes(searchTerm)
  );

  const openEditTemplate = (template: EmailTemplate) => {
    setEditTemplate(template);
    setEditTriggerDays(template.trigger_days_before?.toString() || "");
    setEditSubject(template.subject_da || "");
  };

  const saveTemplate = async () => {
    if (!editTemplate) return;
    
    try {
      const updates: any = {
        subject_da: editSubject,
        trigger_days_before: editTriggerDays === "" ? null : parseInt(editTriggerDays)
      };

      const { error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', editTemplate.id);

      if (error) throw error;

      toast.success('Skabelon opdateret');
      setEditTemplate(null);
      fetchData();
    } catch (error) {
      toast.error('Kunne ikke gemme ændringer');
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 p-4 md:p-6">
          <div className="flex items-center gap-4 mb-6">
            <SidebarTrigger />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Smartphone className="h-6 w-6" />
                Personlig Gæsteside
              </h1>
              <p className="text-muted-foreground">
                Administrer magic links, bageri og portal information
              </p>
            </div>
          </div>

          <Tabs defaultValue="links" className="space-y-4">
            <TabsList>
              <TabsTrigger value="links" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Magic Links
              </TabsTrigger>
              <TabsTrigger value="bakery" className="flex items-center gap-2">
                <Croissant className="h-4 w-4" />
                Bageri
              </TabsTrigger>
              <TabsTrigger value="info" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Portal Info
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Skabeloner
              </TabsTrigger>
            </TabsList>

            {/* MAGIC LINKS TAB */}
            <TabsContent value="links" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Magic Links til Gæster</CardTitle>
                  <CardDescription>
                    Generer og administrer personlige links til gæsteportalen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Søg efter navn eller booking..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Button variant="outline" onClick={fetchData}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Opdater
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking</TableHead>
                        <TableHead>Navn</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Magic Link</TableHead>
                        <TableHead>Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow key={customer.booking_id}>
                          <TableCell className="font-medium">
                            {customer.booking_id}
                          </TableCell>
                          <TableCell>
                            {customer.first_name} {customer.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {customer.email || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {customer.arrival_date} → {customer.departure_date}
                          </TableCell>
                          <TableCell>
                            {customer.magic_token ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Genereret
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50">
                                Ikke genereret
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {customer.magic_token ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyMagicLink(customer.booking_id, customer.magic_token!)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(`https://jelling.vercel.app/m/${customer.booking_id}/${customer.magic_token}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                  {customer.email && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => sendWelcomeEmail(customer.booking_id)}
                                      disabled={sendingEmail === customer.booking_id}
                                      title="Send velkomst email"
                                    >
                                      {sendingEmail === customer.booking_id ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Mail className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => generateMagicToken(customer.booking_id)}
                                  disabled={generatingToken === customer.booking_id}
                                >
                                  {generatingToken === customer.booking_id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Plus className="h-4 w-4 mr-1" />
                                  )}
                                  Generer
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BAGERI TAB */}
            <TabsContent value="bakery" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Bageri Produkter</CardTitle>
                  <CardDescription>
                    Administrer produkter tilgængelige for gæster
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end mb-4">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Tilføj Produkt
                    </Button>
                  </div>

                  {bakeryProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Croissant className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Ingen bageri produkter endnu</p>
                      <p className="text-sm">Tilføj produkter som gæster kan bestille</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Navn</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Pris</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Handlinger</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bakeryProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell>{product.price} kr</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={product.is_available}
                                  onCheckedChange={async (checked) => {
                                    await supabase
                                      .from('bakery_products')
                                      .update({ is_available: checked })
                                      .eq('id', product.id);
                                    fetchData();
                                    toast.success(checked ? 'Produkt tilgængeligt' : 'Produkt udsolgt');
                                  }}
                                />
                                <span className={product.is_available ? 'text-green-600' : 'text-muted-foreground'}>
                                  {product.is_available ? 'Tilgængelig' : 'Udsolgt'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" title="Rediger pris">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PORTAL INFO TAB */}
            <TabsContent value="info" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Praktisk Information</CardTitle>
                  <CardDescription>
                    Information der vises på gæsteportalen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end mb-4">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Tilføj Information
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titel</TableHead>
                        <TableHead>Indhold</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portalInfo.map((info) => (
                        <TableRow key={info.id}>
                          <TableCell className="font-medium">{info.title}</TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {info.content.replace(/\\n/g, ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={info.is_active ? "default" : "secondary"}>
                              {info.is_active ? "Aktiv" : "Skjult"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* EMAIL SKABELONER TAB */}
            <TabsContent value="emails" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Skabeloner</CardTitle>
                  <CardDescription>
                    Administrer email skabeloner og automatisk afsendelse
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>Beskrivelse</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {template.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {template.description}
                          </TableCell>
                          <TableCell>
                            {template.trigger_days_before !== null ? (
                              <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                <Clock className="h-3 w-3" />
                                {template.trigger_days_before} dage før
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Manuel</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={template.is_active}
                                onCheckedChange={async (checked) => {
                                  await supabase
                                    .from('email_templates')
                                    .update({ is_active: checked })
                                    .eq('id', template.id);
                                  fetchData();
                                  toast.success(checked ? 'Template aktiveret' : 'Template deaktiveret');
                                }}
                              />
                              <span className={template.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                                {template.is_active ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                title="Vis preview"
                                onClick={() => setPreviewTemplate(template)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                title="Rediger"
                                onClick={() => openEditTemplate(template)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {emailTemplates.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Ingen email skabeloner endnu</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* EMAIL LOG */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Sendte Emails
                  </CardTitle>
                  <CardDescription>
                    Log over sendte emails (sidste 50)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {emailLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Ingen emails sendt endnu</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tidspunkt</TableHead>
                          <TableHead>Modtager</TableHead>
                          <TableHead>Emne</TableHead>
                          <TableHead>Booking</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(log.sent_at).toLocaleString('da-DK')}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{log.recipient_name}</div>
                                <div className="text-sm text-muted-foreground">{log.recipient_email}</div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                            <TableCell>{log.booking_id}</TableCell>
                            <TableCell>
                              <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                                {log.status === 'sent' ? 'Sendt' : log.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* PREVIEW DIALOG */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview: {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Emne (DA)</Label>
              <p className="text-sm p-2 bg-muted rounded">{previewTemplate?.subject_da}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Email Indhold</Label>
              <div 
                className="border rounded p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: previewTemplate?.body_html || '' }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Rediger: {editTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Opdater email skabelon indstillinger
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="triggerDays">Trigger (dage før ankomst)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="triggerDays"
                  type="number"
                  min="0"
                  max="30"
                  value={editTriggerDays}
                  onChange={(e) => setEditTriggerDays(e.target.value)}
                  placeholder="Antal dage"
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  {editTriggerDays === "" ? "Manuel afsendelse" : `${editTriggerDays} dage før ankomst`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lad feltet være tomt for manuel afsendelse. Sæt til 0 for afsendelse på ankomstdagen.
              </p>
            </div>
            <div>
              <Label htmlFor="subject">Emne (DA)</Label>
              <Input
                id="subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Email emne"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>
              Annuller
            </Button>
            <Button onClick={saveTemplate}>
              Gem ændringer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default PersonligSide;
