import { useEffect, useState, useMemo } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
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
  ShoppingCart,
  CheckCircle,
  XCircle,
  Package,
  Printer,
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
  name_en: string | null;
  name_de: string | null;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
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
  include_portal_box: boolean;
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
  created_at: string;
}

interface BakeryOrder {
  id: string;
  booking_id: number;
  customer_name: string;
  items: { name: string; quantity: number; price: number }[];
  total_price: number;
  pickup_date: string;
  status: 'pending' | 'confirmed' | 'ready' | 'collected' | 'cancelled';
  created_at: string;
}

const PersonligSide = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [portalInfo, setPortalInfo] = useState<PortalInfo[]>([]);
  const [bakeryProducts, setBakeryProducts] = useState<BakeryProduct[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [bakeryOrders, setBakeryOrders] = useState<BakeryOrder[]>([]);
  const [ordersDateFilter, setOrdersDateFilter] = useState<string>('');
  const [showBakeryOrders, setShowBakeryOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingToken, setGeneratingToken] = useState<number | null>(null);
  const [sendingEmail, setSendingEmail] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [editTriggerDays, setEditTriggerDays] = useState<string>("");
  const [editSubject, setEditSubject] = useState<string>("");
  const [editBodyHtml, setEditBodyHtml] = useState<string>("");
  const [editIncludePortalBox, setEditIncludePortalBox] = useState<boolean>(true);
  
  // Bageri state
  const [editProduct, setEditProduct] = useState<BakeryProduct | null>(null);
  const [newProduct, setNewProduct] = useState(false);
  const [productName, setProductName] = useState("");
  const [productNameEn, setProductNameEn] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategory, setProductCategory] = useState("brod");
  const [productDescription, setProductDescription] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Portal Info state
  const [editInfo, setEditInfo] = useState<PortalInfo | null>(null);
  const [newInfo, setNewInfo] = useState(false);
  const [infoTitle, setInfoTitle] = useState("");
  const [infoTitleEn, setInfoTitleEn] = useState("");
  const [infoContent, setInfoContent] = useState("");
  const [infoContentEn, setInfoContentEn] = useState("");
  const [infoIcon, setInfoIcon] = useState("info");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Hent aktive/kommende kunder (departure_date >= i dag)
      const today = new Date().toISOString().split('T')[0];
      
      const { data: regular } = await supabase
        .from('regular_customers')
        .select('booking_id, first_name, last_name, email, magic_token, arrival_date, departure_date')
        .gte('departure_date', today)
        .order('booking_id', { ascending: false })
        .limit(1000);

      const { data: seasonal } = await supabase
        .from('seasonal_customers')
        .select('booking_id, first_name, last_name, email, magic_token, arrival_date, departure_date')
        .gte('departure_date', today)
        .order('booking_id', { ascending: false })
        .limit(1000);

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
        .order('created_at', { ascending: false })
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

  // Hent bageri bestillinger
  const fetchBakeryOrders = async (date?: string) => {
    try {
      const filterDate = date || ordersDateFilter;
      let url = 'https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/bakery-api?action=admin-orders';
      if (filterDate) {
        url += `&date=${filterDate}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setBakeryOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Fejl ved hentning af bestillinger:', error);
    }
  };

  // Opdater bestilling status
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch(
        'https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/bakery-api?action=update-status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, status }),
        }
      );
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        fetchBakeryOrders();
      } else {
        toast.error(data.error || 'Kunne ikke opdatere status');
      }
    } catch (error) {
      toast.error('Fejl ved opdatering af status');
    }
  };

  // Print bestilling
  const printOrder = (order: BakeryOrder) => {
    const printContent = `
      <html>
      <head><title>Bageri Bestilling</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 24px; }
        .items { margin: 20px 0; }
        .item { padding: 5px 0; border-bottom: 1px dashed #ccc; }
        .total { font-size: 20px; font-weight: bold; margin-top: 20px; }
      </style>
      </head>
      <body>
        <h1>Bageri Bestilling #${order.id.slice(0, 8)}</h1>
        <p><strong>Kunde:</strong> ${order.customer_name}</p>
        <p><strong>Booking:</strong> ${order.booking_id}</p>
        <p><strong>Afhentning:</strong> ${new Date(order.pickup_date).toLocaleDateString('da-DK')}</p>
        <div class="items">
          ${order.items.map(item => `<div class="item">${item.quantity}x ${item.name} - ${item.quantity * item.price} kr</div>`).join('')}
        </div>
        <div class="total">Total: ${order.total_price} kr</div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: string; label: string }> = {
      pending: { variant: 'secondary', label: 'Afventer' },
      confirmed: { variant: 'default', label: 'Bekræftet' },
      ready: { variant: 'default', label: 'Klar' },
      collected: { variant: 'outline', label: 'Afhentet' },
      cancelled: { variant: 'destructive', label: 'Annulleret' },
    };
    return styles[status] || { variant: 'secondary', label: status };
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
    setEditBodyHtml(template.body_html || "");
    setEditIncludePortalBox(template.include_portal_box !== false);
  };

  const saveTemplate = async () => {
    if (!editTemplate) return;
    
    try {
      const updates: any = {
        subject_da: editSubject,
        body_html: editBodyHtml,
        trigger_days_before: editTriggerDays === "" ? null : parseInt(editTriggerDays),
        include_portal_box: editIncludePortalBox
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

  // BAGERI FUNKTIONER
  const openEditProduct = (product: BakeryProduct) => {
    setEditProduct(product);
    setNewProduct(false);
    setProductName(product.name);
    setProductNameEn(product.name_en || "");
    setProductPrice(product.price.toString());
    setProductCategory(product.category);
    setProductDescription(product.description || "");
    setProductImageUrl(product.image_url || "");
  };

  const openNewProduct = () => {
    setEditProduct(null);
    setNewProduct(true);
    setProductName("");
    setProductNameEn("");
    setProductPrice("");
    setProductCategory("brod");
    setProductDescription("");
    setProductImageUrl("");
  };

  const saveProduct = async () => {
    try {
      const productData = {
        name: productName,
        name_en: productNameEn || null,
        description: productDescription || null,
        price: parseFloat(productPrice),
        category: productCategory,
        image_url: productImageUrl || null,
        is_available: true,
        sort_order: bakeryProducts.length + 1
      };

      if (editProduct) {
        const { error } = await supabase
          .from('bakery_products')
          .update(productData)
          .eq('id', editProduct.id);
        if (error) throw error;
        toast.success('Produkt opdateret');
      } else {
        const { error } = await supabase
          .from('bakery_products')
          .insert(productData);
        if (error) throw error;
        toast.success('Produkt tilføjet');
      }

      setEditProduct(null);
      setNewProduct(false);
      fetchData();
    } catch (error) {
      toast.error('Kunne ikke gemme produkt');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Er du sikker på du vil slette dette produkt?')) return;
    try {
      const { error } = await supabase.from('bakery_products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Produkt slettet');
      fetchData();
    } catch (error) {
      toast.error('Kunne ikke slette produkt');
    }
  };

  // Upload produkt billede
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      toast.info('Uploader billede...');

      // Upload til Supabase Storage
      const fileName = `bakery-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('bakery-products')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload fejl:', uploadError);
        toast.error('Kunne ikke uploade billede');
        return;
      }

      // Hent public URL
      const { data: urlData } = supabase.storage
        .from('bakery-products')
        .getPublicUrl(fileName);

      setProductImageUrl(urlData.publicUrl);
      toast.success('Billede uploadet!');
    } catch (error) {
      console.error('Upload fejl:', error);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploadingImage(false);
    }
  };

  // PORTAL INFO FUNKTIONER
  const openEditInfo = (info: PortalInfo) => {
    setEditInfo(info);
    setNewInfo(false);
    setInfoTitle(info.title);
    setInfoContent(info.content);
    setInfoIcon(info.icon);
  };

  const openNewInfo = () => {
    setEditInfo(null);
    setNewInfo(true);
    setInfoTitle("");
    setInfoContent("");
    setInfoIcon("info");
  };

  const saveInfo = async () => {
    try {
      const infoData = {
        key: infoTitle.toLowerCase().replace(/\s+/g, '_'),
        title: infoTitle,
        content: infoContent,
        icon: infoIcon,
        is_active: true,
        sort_order: portalInfo.length + 1
      };

      if (editInfo) {
        const { error } = await supabase
          .from('portal_info')
          .update(infoData)
          .eq('id', editInfo.id);
        if (error) throw error;
        toast.success('Information opdateret');
      } else {
        const { error } = await supabase
          .from('portal_info')
          .insert(infoData);
        if (error) throw error;
        toast.success('Information tilføjet');
      }

      setEditInfo(null);
      setNewInfo(false);
      fetchData();
    } catch (error) {
      toast.error('Kunne ikke gemme information');
    }
  };

  const deleteInfo = async (id: string) => {
    if (!confirm('Er du sikker på du vil slette denne information?')) return;
    try {
      const { error } = await supabase.from('portal_info').delete().eq('id', id);
      if (error) throw error;
      toast.success('Information slettet');
      fetchData();
    } catch (error) {
      toast.error('Kunne ikke slette information');
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
                              {new Date(log.created_at).toLocaleString('da-DK')}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div>
              <Label htmlFor="bodyHtml">Email Indhold</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Kopier tekst fra Word, Canva eller andet program - formatering og billeder bevares
              </p>
              <div className="border rounded-md">
                <ReactQuill
                  theme="snow"
                  value={editBodyHtml}
                  onChange={setEditBodyHtml}
                  style={{ minHeight: '300px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline'],
                      [{ 'color': [] }, { 'background': [] }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      [{ 'align': [] }],
                      ['link', 'image'],
                      ['clean']
                    ],
                  }}
                />
              </div>
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                <p className="font-medium text-blue-800 mb-1">💡 Variabler du kan bruge:</p>
                <ul className="text-blue-700 text-xs space-y-1">
                  <li>• <code className="bg-blue-100 px-1 rounded">{"{{guest_name}}"}</code> = Gæstens navn</li>
                  <li>• <code className="bg-blue-100 px-1 rounded">{"{{arrival_date}}"}</code> = Ankomstdato</li>
                  <li>• <code className="bg-blue-100 px-1 rounded">{"{{departure_date}}"}</code> = Afrejsedato</li>
                  <li>• Link og QR-kode tilføjes automatisk via "Portal-kassen"</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-sm font-medium">Inkluder Portal-kasse</Label>
                <p className="text-xs text-muted-foreground">
                  Tilføj kasse med magic link og QR-kode i bunden af emailen
                </p>
              </div>
              <Switch
                checked={editIncludePortalBox}
                onCheckedChange={setEditIncludePortalBox}
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

      {/* BAGERI PRODUKT DIALOG */}
      <Dialog open={newProduct || !!editProduct} onOpenChange={() => { setNewProduct(false); setEditProduct(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editProduct ? 'Rediger Produkt' : 'Tilføj Produkt'}</DialogTitle>
            <DialogDescription>Udfyld produktinformation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="productName">Navn (DA)</Label>
                <Input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="productNameEn">Navn (EN)</Label>
                <Input id="productNameEn" value={productNameEn} onChange={(e) => setProductNameEn(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="productPrice">Pris (kr)</Label>
                <Input id="productPrice" type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="productCategory">Kategori</Label>
                <select
                  id="productCategory"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full h-10 px-3 border rounded-md"
                >
                  <option value="brod">Brød</option>
                  <option value="wienerbroed">Wienerbrød</option>
                  <option value="kage">Kager</option>
                  <option value="mejeri">Mejeri</option>
                  <option value="drikke">Drikkevarer</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="productDescription">Beskrivelse</Label>
              <Textarea id="productDescription" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} />
            </div>
            <div>
              <Label>Produktbillede</Label>
              <div className="mt-2 flex items-start gap-4">
                {productImageUrl ? (
                  <div className="relative">
                    <img 
                      src={productImageUrl} 
                      alt="Preview" 
                      className="w-24 h-24 object-cover rounded border"
                    />
                    <Button 
                      type="button"
                      size="sm" 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                      onClick={() => setProductImageUrl("")}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                    Intet billede
                  </div>
                )}
                <div className="flex-1">
                  <Input 
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {uploadingImage ? 'Uploader...' : 'Vælg et billede fra din computer'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewProduct(false); setEditProduct(null); }}>Annuller</Button>
            <Button onClick={saveProduct}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </SidebarProvider>
  );
};

export default PersonligSide;
