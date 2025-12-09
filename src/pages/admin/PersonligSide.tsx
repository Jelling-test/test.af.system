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
} from "lucide-react";
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

const PersonligSide = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [portalInfo, setPortalInfo] = useState<PortalInfo[]>([]);
  const [bakeryProducts, setBakeryProducts] = useState<BakeryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingToken, setGeneratingToken] = useState<number | null>(null);

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
    const link = `https://portal.jellingcamping.dk/m/${bookingId}/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Magic link kopieret til udklipsholder');
  };

  const filteredCustomers = customers.filter(c =>
    c.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.booking_id?.toString().includes(searchTerm)
  );

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
                                    onClick={() => window.open(`https://portal.jellingcamping.dk/m/${customer.booking_id}/${customer.magic_token}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
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
                              <Badge variant={product.is_available ? "default" : "secondary"}>
                                {product.is_available ? "Tilgængelig" : "Udsolgt"}
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
          </Tabs>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default PersonligSide;
