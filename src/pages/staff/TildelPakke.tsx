import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Search, CheckCircle, Printer, Package as PackageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

const TildelPakke = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const prefilledBooking = searchParams.get('booking');

  const [step, setStep] = useState(1); // 1: Search, 2: Select Package, 3: Payment, 4: Success
  const [isLoading, setIsLoading] = useState(false);
  const [bookingNummer, setBookingNummer] = useState(prefilledBooking || "");
  const [booking, setBooking] = useState<any>(null);
  const [maaler, setMaaler] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("kontant");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  useEffect(() => {
    checkUserRole();
    if (prefilledBooking) {
      searchBooking();
    }
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        setIsAdmin(!!roleData);
      }
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  const searchBooking = async () => {
    if (!bookingNummer.trim()) {
      toast({
        title: "Fejl",
        description: "Indtast venligst et booking nummer",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Søg i seasonal_customers først
      const { data: seasonalCustomer } = await (supabase as any)
        .from('seasonal_customers')
        .select('*')
        .eq('booking_id', parseInt(bookingNummer.trim()))
        .eq('checked_in', true)
        .maybeSingle();

      // Hvis ikke fundet, søg i regular_customers
      let bookingData = null;
      let kundeType = '';
      
      if (seasonalCustomer) {
        bookingData = {
          id: seasonalCustomer.id,
          ref_id: seasonalCustomer.booking_id.toString(),
          data: {
            booking_nummer: seasonalCustomer.booking_id,
            navn: `${seasonalCustomer.first_name} ${seasonalCustomer.last_name}`,
            email: seasonalCustomer.email,
            phone: seasonalCustomer.phone,
            check_in: seasonalCustomer.arrival_date,
            check_out: seasonalCustomer.departure_date,
            kunde_type: seasonalCustomer.customer_type || 'sæson',
            maaler_navn: seasonalCustomer.meter_id,
          }
        };
        kundeType = seasonalCustomer.customer_type || 'sæson';
      } else {
        const { data: regularCustomer } = await (supabase as any)
          .from('regular_customers')
          .select('*')
          .eq('booking_id', parseInt(bookingNummer.trim()))
          .eq('checked_in', true)
          .maybeSingle();

        if (regularCustomer) {
          bookingData = {
            id: regularCustomer.id,
            ref_id: regularCustomer.booking_id.toString(),
            data: {
              booking_nummer: regularCustomer.booking_id,
              navn: `${regularCustomer.first_name} ${regularCustomer.last_name}`,
              email: regularCustomer.email,
              phone: regularCustomer.phone,
              check_in: regularCustomer.arrival_date,
              check_out: regularCustomer.departure_date,
              kunde_type: regularCustomer.customer_type || 'kørende',
              maaler_navn: regularCustomer.meter_id,
            }
          };
          kundeType = regularCustomer.customer_type || 'kørende';
        }
      }

      if (!bookingData) {
        toast({
          title: "Ikke fundet",
          description: "Booking nummer blev ikke fundet eller kunden er ikke checked in",
          variant: "destructive",
        });
        return;
      }

      setBooking(bookingData);

      // Get assigned meter
      const { data: maalerData } = await (supabase as any)
        .from('plugin_data')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('module', 'målere')
        .eq('data->>booking_nummer', bookingNummer.trim())
        .maybeSingle();

      setMaaler(maalerData);

      // Load packages for kunde_type
      // For kørende: vis dagspakker, for sæson: vis startpakker
      const expectedKategori = kundeType === 'kørende' ? 'dagspakke' : 'startpakke';
      
      const { data: packageTypes, error: packageError } = await (supabase as any)
        .from('plugin_data')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('module', 'pakke_typer')
        .eq('data->>kunde_type', kundeType)
        .eq('data->>pakke_kategori', expectedKategori)
        .eq('data->>aktiv', 'true')
        .order('data->>enheder', { ascending: true });

      if (packageError) throw packageError;

      setPackages(packageTypes || []);
      setStep(2);
    } catch (error: any) {
      console.error("Error searching booking:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke søge efter booking",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePackageSelection = (pkg: any) => {
    setSelectedPackage(pkg);
    setStep(3);
  };

  const handleConfirm = async () => {
    if (!selectedPackage || !booking) return;

    setIsProcessing(true);
    setShowConfirmDialog(false);

    try {
      const now = new Date().toISOString();
      
      // Create pakke record
      const pakkeData = {
        organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        module: 'pakker',
        ref_id: `pakke_${Date.now()}`,
        data: {
          booking_nummer: bookingNummer.trim(),
          pakke_type_id: selectedPackage.ref_id,
          enheder_total: selectedPackage.data?.enheder || 0,
          enheder_tilbage: selectedPackage.data?.enheder || 0,
          enheder_brugt: 0,
          pris: selectedPackage.data?.pris || 0,
          status: 'aktiv',
          betaling_metode: 'reception',
          betaling_type: paymentMethod,
          maaler_id: maaler?.ref_id,
          aktiveret_dato: now,
        },
        created_at: now,
      };

      const { data: newPakke, error: pakkeError } = await (supabase as any)
        .from('plugin_data')
        .insert(pakkeData)
        .select()
        .single();

      if (pakkeError) throw pakkeError;

      // Create payment record
      const betalingData = {
        organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        module: 'betalinger',
        ref_id: `betaling_${Date.now()}`,
        data: {
          booking_nummer: bookingNummer.trim(),
          pakke_id: newPakke.ref_id,
          beloeb: selectedPackage.data?.pris || 0,
          metode: paymentMethod,
          status: 'gennemfoert',
          behandlet_af: 'staff',
          dato: now,
        },
        created_at: now,
      };

      const { error: betalingError } = await (supabase as any)
        .from('plugin_data')
        .insert(betalingData);

      if (betalingError) throw betalingError;

      // Turn on meter if assigned
      if (maaler) {
        try {
          await supabase.functions.invoke('toggle-power', {
            body: {
              maaler_id: maaler.ref_id,
              action: 'on',
              booking_nummer: bookingNummer.trim(),
            }
          });
        } catch (powerError) {
          console.error("Error turning on power:", powerError);
          // Don't fail the whole operation if power toggle fails
        }
      }

      // Set receipt data
      setReceiptData({
        booking: booking.data,
        package: selectedPackage.data,
        payment: paymentMethod,
        maaler: maaler?.data,
        dato: new Date().toLocaleString('da-DK'),
      });

      toast({
        title: "Pakke tildelt",
        description: `${selectedPackage.data?.navn} er nu aktiveret`,
      });

      setStep(4);
    } catch (error: any) {
      console.error("Error confirming package assignment:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke tildele pakke",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const resetForm = () => {
    setStep(1);
    setBookingNummer("");
    setBooking(null);
    setMaaler(null);
    setPackages([]);
    setSelectedPackage(null);
    setPaymentMethod("kontant");
    setReceiptData(null);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background animate-fade-in">
        <StaffSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="border-b bg-card h-14 sm:h-16 flex items-center px-4 sticky top-0 z-10 print:hidden">
            <SidebarTrigger className="mr-4" aria-label="Toggle sidebar" />
            <h1 className="text-lg sm:text-xl font-bold">Tildel pakke (reception)</h1>
          </header>

          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <div className="max-w-4xl mx-auto">
              {/* Step 1: Search Booking */}
              {step === 1 && (
                <Card className="animate-scale-in">
                  <CardHeader>
                    <CardTitle>Søg efter booking</CardTitle>
                    <CardDescription>
                      Indtast booking nummer for at tildele pakke
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="booking">Booking nummer</Label>
                      <div className="flex gap-2">
                        <Input
                          id="booking"
                          placeholder="f.eks. 41967"
                          value={bookingNummer}
                          onChange={(e) => setBookingNummer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              searchBooking();
                            }
                          }}
                          disabled={isLoading}
                        />
                        <Button 
                          onClick={searchBooking}
                          disabled={isLoading || !bookingNummer.trim()}
                          className="min-h-[44px]"
                          aria-label="Søg efter booking"
                        >
                          {isLoading ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              <span>Søg</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Select Package */}
              {step === 2 && booking && (
                <div className="space-y-6">
                  {/* Booking Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Booking detaljer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Navn</p>
                          <p className="font-medium">
                            {booking.data?.fornavn} {booking.data?.efternavn}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Kunde type</p>
                          <p className="font-medium capitalize">{booking.data?.kunde_type}</p>
                        </div>
                        {maaler && (
                          <div>
                            <p className="text-sm text-muted-foreground">Måler</p>
                            <p className="font-medium">{maaler.data?.måler_navn}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Package Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Vælg pakke</CardTitle>
                      <CardDescription>
                        {packages.length} pakker tilgængelige
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {packages.map((pkg) => (
                          <Card
                            key={pkg.ref_id}
                            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
                            onClick={() => handlePackageSelection(pkg)}
                          >
                            <CardHeader>
                              <CardTitle className="text-2xl text-primary">
                                {pkg.data?.enheder} kWh
                              </CardTitle>
                              {pkg.data?.dage && (
                                <CardDescription>
                                  {pkg.data.dage} dage
                                </CardDescription>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold mb-2">
                                {pkg.data?.pris} kr
                              </div>
                              <Button className="w-full" size="sm">
                                Vælg pakke
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {packages.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Ingen pakker tilgængelige for denne kunde type
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Button variant="outline" onClick={() => setStep(1)}>
                    Tilbage
                  </Button>
                </div>
              )}

              {/* Step 3: Payment Method */}
              {step === 3 && selectedPackage && (
                <div className="space-y-6">
                  {/* Selected Package */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Valgt pakke</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">
                            {selectedPackage.data?.enheder} kWh
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {selectedPackage.data?.navn}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-primary">
                            {selectedPackage.data?.pris} kr
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Method */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Betalingsmetode</CardTitle>
                      <CardDescription>
                        Vælg hvordan kunden betaler
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                        <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="kontant" id="kontant" />
                          <Label htmlFor="kontant" className="flex-1 cursor-pointer">
                            <span className="font-medium">Kontant</span>
                            <p className="text-sm text-muted-foreground">Betaling med kontanter</p>
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="kort" id="kort" />
                          <Label htmlFor="kort" className="flex-1 cursor-pointer">
                            <span className="font-medium">Kort (terminal)</span>
                            <p className="text-sm text-muted-foreground">Betaling med betalingskort</p>
                          </Label>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer border-primary/50">
                            <RadioGroupItem value="gratis" id="gratis" />
                            <Label htmlFor="gratis" className="flex-1 cursor-pointer">
                              <span className="font-medium">Gratis</span>
                              <p className="text-sm text-muted-foreground">Ingen betaling (kun admin)</p>
                            </Label>
                          </div>
                        )}
                      </RadioGroup>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Tilbage
                    </Button>
                    <Button 
                      onClick={() => setShowConfirmDialog(true)}
                      className="flex-1"
                      size="lg"
                    >
                      <PackageIcon className="h-4 w-4 mr-2" />
                      Tildel pakke
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Success & Receipt */}
              {step === 4 && receiptData && (
                <div className="space-y-6">
                  <Card className="border-green-200 bg-green-50 print:border-none print:bg-white">
                    <CardHeader className="text-center print:border-b">
                      <div className="flex justify-center mb-4 print:hidden">
                        <CheckCircle className="h-16 w-16 text-green-600" />
                      </div>
                      <CardTitle className="text-green-900 print:text-foreground">
                        Pakke tildelt!
                      </CardTitle>
                      <CardDescription className="print:hidden">
                        Strømmen er nu aktiveret
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Receipt */}
                      <div className="bg-white rounded-lg p-6 space-y-4 print:p-0">
                        <div className="text-center border-b pb-4 print:pb-2">
                          <h3 className="font-bold text-lg">Jelling Camping</h3>
                          <p className="text-sm text-muted-foreground">Strømportal</p>
                          <p className="text-xs text-muted-foreground mt-1">{receiptData.dato}</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Booking:</span>
                            <span className="font-medium">{bookingNummer}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gæst:</span>
                            <span className="font-medium">
                              {receiptData.booking?.fornavn} {receiptData.booking?.efternavn}
                            </span>
                          </div>
                          {receiptData.maaler && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Måler:</span>
                              <span className="font-medium">{receiptData.maaler.måler_navn}</span>
                            </div>
                          )}
                        </div>

                        <div className="border-t pt-4">
                          <div className="flex justify-between mb-2">
                            <span className="font-medium">Pakke:</span>
                            <span>{receiptData.package?.navn}</span>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span className="font-medium">Enheder:</span>
                            <span>{receiptData.package?.enheder} kWh</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>Total:</span>
                            <span>{receiptData.package?.pris} kr</span>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Betalingsmetode:</span>
                            <span className="font-medium capitalize">{receiptData.payment}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="font-medium text-green-600">Betalt</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-3 print:hidden">
                        <Button onClick={printReceipt} size="lg">
                          <Printer className="h-4 w-4 mr-2" />
                          Print kvittering
                        </Button>
                        <Button variant="outline" onClick={resetForm}>
                          Tildel ny pakke
                        </Button>
                        <Button variant="ghost" onClick={() => navigate('/staff/dashboard')}>
                          Tilbage til dashboard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft tildeling</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil tildele denne pakke?
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Pakke:</span>
                  <span>{selectedPackage?.data?.navn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Pris:</span>
                  <span>{selectedPackage?.data?.pris} kr</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Betaling:</span>
                  <span className="capitalize">{paymentMethod}</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Annuller
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Behandler...
                </>
              ) : (
                "Bekræft"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default TildelPakke;
