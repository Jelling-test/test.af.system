import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Search, Trash2, Send, Users } from "lucide-react";

interface EmailSubscriber {
  id: string;
  customer_name: string;
  email: string;
  customer_type: string;
  year: number;
  booking_number: string | null;
  checked_in_at: string;
}

const AdminGruppeMails = () => {
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [filteredSubscribers, setFilteredSubscribers] = useState<EmailSubscriber[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Email form states
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  useEffect(() => {
    if (searchEmail.trim()) {
      const filtered = subscribers.filter(sub =>
        sub.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
        sub.customer_name.toLowerCase().includes(searchEmail.toLowerCase())
      );
      setFilteredSubscribers(filtered);
    } else {
      setFilteredSubscribers(subscribers);
    }
  }, [searchEmail, subscribers]);

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("email_subscribers")
        .select("*")
        .order("checked_in_at", { ascending: false });

      if (error) throw error;
      setSubscribers(data || []);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      toast.error("Fejl ved hentning af email liste");
    }
  };

  const deleteSubscriber = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne email?")) return;

    try {
      const { error } = await (supabase as any)
        .from("email_subscribers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Email slettet");
      fetchSubscribers();
    } catch (error) {
      console.error("Error deleting subscriber:", error);
      toast.error("Fejl ved sletning af email");
    }
  };

  const getRecipients = async (type: string, year?: string) => {
    let query = (supabase as any).from("email_subscribers").select("email");

    switch (type) {
      case "all_checked_in":
        // Alle indtjekket - hent fra regular_customers og seasonal_customers
        const { data: regularCustomers } = await (supabase as any)
          .from("regular_customers")
          .select("email")
          .eq("checked_in", true)
          .not("email", "is", null);
        
        const { data: seasonalCustomers } = await (supabase as any)
          .from("seasonal_customers")
          .select("email")
          .eq("checked_in", true)
          .not("email", "is", null);

        const allEmails = [
          ...(regularCustomers?.map((c: any) => c.email) || []),
          ...(seasonalCustomers?.map((c: any) => c.email) || [])
        ];
        return [...new Set(allEmails)]; // Fjern duplikater

      case "checked_in_kørende":
        const { data: checkedInRegular } = await (supabase as any)
          .from("regular_customers")
          .select("email")
          .eq("checked_in", true)
          .not("email", "is", null);
        return checkedInRegular?.map((c: any) => c.email) || [];

      case "checked_in_sæson":
        const { data: checkedInSeasonal } = await (supabase as any)
          .from("seasonal_customers")
          .select("email")
          .eq("checked_in", true)
          .not("email", "is", null);
        return checkedInSeasonal?.map((c: any) => c.email) || [];

      case "kørende_year":
        query = query.eq("customer_type", "kørende").eq("year", parseInt(year!));
        break;

      case "sæson_year":
        query = query.eq("customer_type", "sæson").eq("year", parseInt(year!));
        break;

      default:
        return [];
    }

    const { data } = await query;
    return data?.map((s: any) => s.email) || [];
  };

  const sendGroupEmail = async (type: string, year?: string) => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Udfyld venligst emne og besked");
      return;
    }

    setLoading(true);
    try {
      const recipients = await getRecipients(type, year);
      
      if (recipients.length === 0) {
        toast.error("Ingen modtagere fundet");
        setLoading(false);
        return;
      }

      // Bekræft før afsendelse
      if (!confirm(`Er du sikker på at du vil sende email til ${recipients.length} modtagere?`)) {
        setLoading(false);
        return;
      }

      toast.info(`Sender emails til ${recipients.length} modtagere...`);

      let successCount = 0;
      let errorCount = 0;

      // Send email til hver modtager
      for (const email of recipients) {
        try {
          const { error } = await supabase.functions.invoke('send-email', {
            body: {
              to: email,
              subject: emailSubject,
              html: emailBody.replace(/\n/g, '<br>'),
              from_name: 'Jelling Camping',
              from_email: 'peter@jellingcamping.dk',
              reply_to: 'peter@jellingcamping.dk'
            }
          });

          if (error) {
            console.error(`Failed to send to ${email}:`, error);
            errorCount++;
          } else {
            successCount++;
          }

          // Lille pause mellem emails for at undgå rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`Error sending to ${email}:`, err);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        toast.warning(`${successCount} emails sendt, ${errorCount} fejlede`);
      } else {
        toast.success(`Alle ${successCount} emails sendt!`);
      }
      
      // Clear form
      setEmailSubject("");
      setEmailBody("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Fejl ved afsendelse af email");
    } finally {
      setLoading(false);
    }
  };

  const updateRecipientCount = async (type: string, year?: string) => {
    const recipients = await getRecipients(type, year);
    setRecipientCount(recipients.length);
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-3 flex-1">
              <Mail className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Gruppe Mails</h1>
                <p className="text-sm text-muted-foreground">Send emails til kundegrupper</p>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 space-y-6 overflow-auto">
            {/* Email Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send Gruppe Email</CardTitle>
                <CardDescription>Vælg modtagere og skriv din besked</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Emne</Label>
                  <Input
                    id="subject"
                    placeholder="Email emne..."
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Besked</Label>
                  <Textarea
                    id="body"
                    placeholder="Skriv din besked her..."
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={6}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Indtjekket kunder */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Indtjekket Kunder</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        onClick={() => sendGroupEmail("all_checked_in")}
                        disabled={loading}
                        className="w-full"
                        variant="outline"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Alle indtjekket
                      </Button>
                      <Button
                        onClick={() => sendGroupEmail("checked_in_kørende")}
                        disabled={loading}
                        className="w-full"
                        variant="outline"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Indtjekket kørende
                      </Button>
                      <Button
                        onClick={() => sendGroupEmail("checked_in_sæson")}
                        disabled={loading}
                        className="w-full"
                        variant="outline"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Indtjekket sæson
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Historiske kunder */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Historiske Kunder</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                          <SelectTrigger>
                            <SelectValue placeholder="Vælg år" />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map(year => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => sendGroupEmail("kørende_year", selectedYear)}
                        disabled={loading}
                        className="w-full"
                        variant="outline"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Kørende {selectedYear}
                      </Button>
                      <Button
                        onClick={() => sendGroupEmail("sæson_year", selectedYear)}
                        disabled={loading}
                        className="w-full"
                        variant="outline"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Sæson {selectedYear}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Email Database */}
            <Card>
              <CardHeader>
                <CardTitle>Email Database</CardTitle>
                <CardDescription>
                  Søg og administrer email adresser ({subscribers.length} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Søg efter email eller navn..."
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Navn</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>År</TableHead>
                          <TableHead>Indtjekket</TableHead>
                          <TableHead className="text-right">Handling</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubscribers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              {searchEmail ? "Ingen resultater" : "Ingen emails i databasen"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSubscribers.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell className="font-medium">{sub.customer_name}</TableCell>
                              <TableCell>{sub.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{sub.customer_type}</Badge>
                              </TableCell>
                              <TableCell>{sub.year}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(sub.checked_in_at).toLocaleDateString('da-DK')}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSubscriber(sub.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminGruppeMails;
