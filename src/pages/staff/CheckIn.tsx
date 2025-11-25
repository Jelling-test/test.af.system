import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Search, CheckCircle, ArrowRight, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CheckIn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1); // 1: Search, 2: Assign Meter, 3: Confirm
  const [isLoading, setIsLoading] = useState(false);
  const [bookingNummer, setBookingNummer] = useState("");
  const [booking, setBooking] = useState<any>(null);
  const [availableMeters, setAvailableMeters] = useState<any[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<string>("");
  const [isConfirming, setIsConfirming] = useState(false);

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
      const { data, error } = await (supabase as any)
        .from('plugin_data')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('module', 'bookinger')
        .eq('ref_id', bookingNummer.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Ikke fundet",
          description: "Booking nummer blev ikke fundet",
          variant: "destructive",
        });
        return;
      }

      setBooking(data);
      
      // Load available meters
      const { data: meters, error: metersError } = await (supabase as any)
        .from('plugin_data')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('module', 'målere')
        .eq('data->>status', 'ledig')
        .order('data->>måler_navn', { ascending: true });

      if (metersError) throw metersError;

      setAvailableMeters(meters || []);
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

  const handleConfirm = async () => {
    if (!selectedMeter || !booking) return;

    setIsConfirming(true);
    try {
      const selectedMeterData = availableMeters.find(m => m.ref_id === selectedMeter);
      
      if (!selectedMeterData) throw new Error("Måler ikke fundet");

      // Update meter: set booking_nummer and status = 'optaget'
      const updatedData = {
        ...selectedMeterData.data,
        booking_nummer: bookingNummer.trim(),
        status: 'optaget',
        assigned_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('plugin_data')
        .update({ data: updatedData })
        .eq('ref_id', selectedMeter)
        .eq('module', 'målere');

      if (error) throw error;

      toast({
        title: "Check-in gennemført",
        description: `${booking.data?.efternavn} er nu tildelt ${selectedMeterData.data?.måler_navn}`,
      });

      setStep(3);
    } catch (error: any) {
      console.error("Error confirming check-in:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke gennemføre check-in",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setBookingNummer("");
    setBooking(null);
    setAvailableMeters([]);
    setSelectedMeter("");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background animate-fade-in">
        <StaffSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="border-b bg-card h-14 sm:h-16 flex items-center px-4 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" aria-label="Toggle sidebar" />
            <h1 className="text-lg sm:text-xl font-bold">Check-in gæst</h1>
          </header>

          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <div className="max-w-3xl mx-auto">
              {/* Progress Indicator */}
              <div className="mb-6 sm:mb-8 animate-fade-in">
                <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto px-4">
                  <div className={`flex items-center gap-1 sm:gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {step > 1 ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : '1'}
                    </div>
                    <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Søg booking</span>
                  </div>
                  
                  <div className={`w-12 h-px ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                  
                  <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {step > 2 ? <CheckCircle className="h-5 w-5" /> : '2'}
                    </div>
                    <span className="text-sm font-medium">Tildel måler</span>
                  </div>
                  
                  <div className={`w-12 h-px ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                  
                  <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {step >= 3 ? <CheckCircle className="h-5 w-5" /> : '3'}
                    </div>
                    <span className="text-sm font-medium">Bekræft</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Search Booking */}
              {step === 1 && (
                <Card className="animate-scale-in">
                  <CardHeader>
                    <CardTitle>Søg efter booking</CardTitle>
                    <CardDescription>
                      Indtast booking nummer for at finde gæsten
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

              {/* Step 2: Assign Meter */}
              {step === 2 && booking && (
                <div className="space-y-4 sm:space-y-6">
                  {/* Booking Details */}
                  <Card className="animate-scale-in">
                    <CardHeader>
                      <CardTitle>Booking detaljer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Navn</p>
                          <p className="font-medium">
                            {booking.data?.fornavn} {booking.data?.efternavn}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Booking nummer</p>
                          <p className="font-medium">{bookingNummer}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Kunde type</p>
                          <p className="font-medium capitalize">{booking.data?.kunde_type}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <p className="font-medium capitalize">{booking.data?.status}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Meter Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Vælg måler</CardTitle>
                      <CardDescription>
                        {availableMeters.length} ledige målere tilgængelige
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="meter">Vælg en ledig måler</Label>
                        <Select value={selectedMeter} onValueChange={setSelectedMeter}>
                          <SelectTrigger id="meter">
                            <SelectValue placeholder="Vælg måler..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMeters.map((meter) => (
                              <SelectItem key={meter.ref_id} value={meter.ref_id}>
                                {meter.data?.måler_navn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {availableMeters.length === 0 && (
                        <p className="text-sm text-destructive">
                          Ingen ledige målere tilgængelige
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      variant="outline" 
                      onClick={resetForm}
                      className="min-h-[44px] sm:w-auto"
                    >
                      Annuller
                    </Button>
                    <Button 
                      onClick={handleConfirm}
                      disabled={!selectedMeter || isConfirming}
                      className="flex-1 min-h-[44px]"
                      aria-label="Bekræft check-in"
                    >
                      {isConfirming ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          <span>Gennemfører...</span>
                        </>
                      ) : (
                        <>
                          <span>Bekræft check-in</span>
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Success */}
              {step === 3 && (
                <Card className="border-green-200 bg-green-50 animate-scale-in">
                  <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                      <CheckCircle className="h-16 w-16 text-green-600" />
                    </div>
                    <CardTitle className="text-green-900">Check-in gennemført!</CardTitle>
                    <CardDescription>
                      Gæsten er nu tildelt en måler
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-white rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Gæst:</span>
                        <span className="font-medium">{booking?.data?.efternavn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Måler:</span>
                        <span className="font-medium">
                          {availableMeters.find(m => m.ref_id === selectedMeter)?.data?.måler_navn}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={() => navigate(`/staff/tildel-pakke?booking=${bookingNummer}`)}
                        size="lg"
                        className="min-h-[44px]"
                        aria-label="Tildel pakke nu"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        <span>Tildel pakke nu</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetForm}
                        className="min-h-[44px]"
                      >
                        Check-in ny gæst
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => navigate('/staff/dashboard')}
                        className="min-h-[44px]"
                      >
                        Tilbage til dashboard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default CheckIn;
