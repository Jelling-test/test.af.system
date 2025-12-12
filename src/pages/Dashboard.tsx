import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Zap, LogOut, User, Power, AlertTriangle, ShoppingCart, Calendar, UtensilsCrossed, Info, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDanishDateTime, formatDanishDate } from "@/utils/dateTime";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [guestSession, setGuestSession] = useState<any>(null);
  const [pakker, setPakker] = useState<any[]>([]);
  const [dagspakke, setDagspakke] = useState<any>(null);
  const [maaler, setMaaler] = useState<any>(null);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [isTogglingPower, setIsTogglingPower] = useState(false);
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [arrivalDate, setArrivalDate] = useState<string | null>(null);
  const [meterStartEnergy, setMeterStartEnergy] = useState<number>(0);
  const [currentEnergy, setCurrentEnergy] = useState<number>(0);
  const [currentPower, setCurrentPower] = useState<number>(0);
  const [currentVoltage, setCurrentVoltage] = useState<number>(0);
  const [currentCurrent, setCurrentCurrent] = useState<number>(0);
  const [kundeType, setKundeType] = useState<'kørende' | 'sæson' | null>(null);
  
  // Ekstra målere
  const [extraMeters, setExtraMeters] = useState<any[]>([]);
  const [extraMeterReadings, setExtraMeterReadings] = useState<Record<string, any>>({});
  const [togglingExtraMeter, setTogglingExtraMeter] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();

    // Reload data when page becomes visible (e.g., returning from Stripe)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("Page became visible, reloading pakke data...");
        loadPakkeData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!guestSession?.booking_nummer) return;

    // Set up real-time subscription for pakke updates
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plugin_data',
          filter: `data->>booking_nummer=eq.${guestSession.booking_nummer}`,
        },
        () => {
          loadPakkeData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guestSession]);

  // Realtime subscription for Power Security feedback
  useEffect(() => {
    if (!maaler?.meter_number) return;

    const powerSecurityChannel = supabase
      .channel('power-security-feedback')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'unauthorized_power_attempts',
          filter: `meter_number=eq.${maaler.meter_number}`,
        },
        (payload: any) => {
          console.log('Power Security event:', payload);
          const reason = payload.new?.details?.reason || 'no_package';
          
          let message = 'Din måler blev slukket automatisk.';
          if (reason === 'no_package_regular' || reason === 'no_package') {
            message = 'Din måler blev slukket - du har ingen aktiv strømpakke. Køb venligst en pakke først.';
          } else if (reason === 'package_expired') {
            message = 'Din måler blev slukket - din pakke er udløbet. Køb venligst en ny pakke.';
          } else if (reason === 'units_exhausted') {
            message = 'Din måler blev slukket - du har opbrugt dine enheder. Køb venligst en tillægspakke.';
          } else if (reason === 'no_customer') {
            message = 'Din måler blev slukket - ingen kunde registreret.';
          }
          
          setIsPowerOn(false);
          toast({
            title: "Strøm slukket automatisk",
            description: message,
            variant: "destructive",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(powerSecurityChannel);
    };
  }, [maaler?.meter_number]);

  const loadDashboardData = async () => {
    try {
      const sessionData = localStorage.getItem("guest_session");
      
      if (!sessionData) {
        navigate("/");
        return;
      }

      const session = JSON.parse(sessionData);
      setGuestSession(session);
      
      // Tjek checked-in status fra booking data
      const checkedIn = session.booking_data?.checked_in === true;
      setIsCheckedIn(checkedIn);
      setArrivalDate(session.booking_data?.arrival_date || null);
      
      await loadPakkeData();
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPakkeData = async () => {
    try {
      const sessionData = localStorage.getItem("guest_session");
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);

      // Query all pakker
      // Hent ALLE pakker (aktiv, udløbet, opbrugt) så kunden kan se historik
      const { data: pakkerData, error: pakkeError } = await (supabase as any)
        .from('plugin_data')
        .select('*')
        .eq('organization_id', session.organization_id)
        .eq('module', 'pakker')
        .eq('data->>booking_nummer', session.booking_nummer)
        .order('created_at', { ascending: true });

      if (pakkeError) throw pakkeError;
      
      if (pakkerData && pakkerData.length > 0) {
        setPakker(pakkerData);
        // Find seneste AKTIVE dagspakke (pakke med varighed_timer og status aktiv)
        const aktivDagspakke = pakkerData
          .filter(p => p.data.varighed_timer && p.data.status === 'aktiv')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        // Hvis ingen aktiv dagspakke, find seneste dagspakke (uanset status)
        const dagsPakke = aktivDagspakke || pakkerData.find(p => p.data.varighed_timer);
        setDagspakke(dagsPakke || pakkerData[0]);
      }

      // Query customer and meter info - check both regular and seasonal
      const { data: customerData, error: customerError } = await (supabase as any)
        .from('regular_customers')
        .select('meter_id, meter_start_energy, meter_start_time')
        .eq('booking_id', session.booking_nummer)
        .maybeSingle();

      const { data: seasonalData } = await (supabase as any)
        .from('seasonal_customers')
        .select('meter_id, meter_start_energy, meter_start_time')
        .eq('booking_id', session.booking_nummer)
        .maybeSingle();

      // Determine customer type FIRST
      const detectedKundeType = customerData ? 'kørende' : (seasonalData ? 'sæson' : null);
      setKundeType(detectedKundeType);

      const activeCustomer = customerData || seasonalData;

      if (customerError) throw customerError;

      if (activeCustomer?.meter_id) {
        const meterNumber = activeCustomer.meter_id;
        
        // Set meter info and start energy
        if (meterNumber) {
          setMaaler({ meter_number: meterNumber });
          setMeterStartEnergy(activeCustomer.meter_start_energy || 0);
        } else {
          // Måler er slettet - vis fejl
          setMaaler(null);
        }

        // Get latest meter reading for power status, energy, power, voltage and current
        const { data: readingData, error: readingError } = await (supabase as any)
          .from('meter_readings')
          .select('state, energy, power, voltage, current')
          .eq('meter_id', meterNumber)
          .order('time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!readingError && readingData) {
          setIsPowerOn(readingData.state === 'ON');
          setCurrentEnergy(readingData.energy || 0);
          setCurrentPower(readingData.power || 0);
          setCurrentVoltage(readingData.voltage || 0);
          setCurrentCurrent(readingData.current || 0);
        }

        // Load consumption history from meter_readings (since meter_start_time)
        if (activeCustomer.meter_start_time) {
          await loadConsumptionHistory(meterNumber, activeCustomer.meter_start_time);
        }
      }

      // Hent ekstra målere
      const bookingType = detectedKundeType === 'sæson' ? 'seasonal' : 'regular';
      const customerRecord = detectedKundeType === 'sæson' ? seasonalData : customerData;
      
      if (customerRecord) {
        // Hent kunde ID fra den korrekte tabel
        const { data: fullCustomer } = await (supabase as any)
          .from(detectedKundeType === 'sæson' ? 'seasonal_customers' : 'regular_customers')
          .select('id')
          .eq('booking_id', session.booking_nummer)
          .maybeSingle();

        if (fullCustomer?.id) {
          const { data: extraMetersData } = await (supabase as any)
            .from('booking_extra_meters')
            .select('*')
            .eq('booking_id', fullCustomer.id)
            .eq('booking_type', bookingType);

          setExtraMeters(extraMetersData || []);

          // Hent meter readings for ekstra målere
          const readings: Record<string, any> = {};
          for (const extraMeter of extraMetersData || []) {
            const { data: reading } = await (supabase as any)
              .from('meter_readings')
              .select('state, energy, power, voltage, current')
              .eq('meter_id', extraMeter.meter_id)
              .order('time', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (reading) {
              readings[extraMeter.meter_id] = reading;
            }
          }
          setExtraMeterReadings(readings);
        }
      }
    } catch (error) {
      console.error("Error loading pakke data:", error);
    }
  };

  const loadConsumptionHistory = async (meterId: string, startTime: string) => {
    try {
      // Get meter readings from the last 7 days, but only since meter was assigned
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const startDate = new Date(startTime) > sevenDaysAgo ? new Date(startTime) : sevenDaysAgo;

      const { data, error } = await (supabase as any)
        .from('meter_readings')
        .select('time, energy')
        .eq('meter_id', meterId)
        .gte('time', startDate.toISOString())
        .order('time', { ascending: true });

      if (error) throw error;
      setConsumptionHistory(data || []);
    } catch (error) {
      console.error("Error loading consumption history:", error);
    }
  };

  const togglePower = async (turnOn: boolean) => {
    if (!maaler || !guestSession) return;
    
    setIsTogglingPower(true);
    try {
      const newState = turnOn ? 'ON' : 'OFF';
      
      // Direkte insert i meter_commands (Power Security håndterer validering)
      const { error } = await supabase
        .from('meter_commands')
        .insert({
          meter_id: maaler.meter_number,
          command: 'set_state',
          value: newState,
          status: 'pending'
        });

      if (error) throw error;

      // Optimistisk opdatering - Power Security sender feedback hvis det fejler
      setIsPowerOn(turnOn);
      toast({
        title: turnOn ? "Tænder strøm..." : "Slukker strøm...",
        description: `Kommando sendt til måler ${maaler.meter_number}`,
      });
    } catch (error: any) {
      console.error("Error toggling power:", error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende kommando",
        variant: "destructive",
      });
    } finally {
      setIsTogglingPower(false);
    }
  };

  // Toggle ekstra måler
  const toggleExtraMeterPower = async (meterId: string, turnOn: boolean) => {
    if (!guestSession) return;
    
    setTogglingExtraMeter(meterId);
    try {
      const newState = turnOn ? 'ON' : 'OFF';
      
      // Direkte insert i meter_commands (Power Security håndterer validering)
      const { error } = await supabase
        .from('meter_commands')
        .insert({
          meter_id: meterId,
          command: 'set_state',
          value: newState,
          status: 'pending'
        });

      if (error) throw error;

      // Opdater ekstra meter readings lokalt (optimistisk)
      setExtraMeterReadings(prev => ({
        ...prev,
        [meterId]: {
          ...prev[meterId],
          state: newState
        }
      }));

      toast({
        title: turnOn ? "Tænder strøm..." : "Slukker strøm...",
        description: `Kommando sendt til måler ${meterId}`,
      });
    } catch (error: any) {
      console.error("Error toggling extra meter:", error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende kommando",
        variant: "destructive",
      });
    } finally {
      setTogglingExtraMeter(null);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("guest_session");
      toast({
        title: "Logget ud",
        description: "Du er nu logget ud",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved logud",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 animate-fade-in">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Calculate total consumption and remaining from all pakker
  const totalEnheder = pakker.reduce((sum, p) => sum + parseFloat(p.data.enheder || '0'), 0);
  
  // Calculate total actual usage (accumulated + current meter + ekstra målere)
  const accumulated = parseFloat(pakker[0]?.data?.accumulated_usage || '0');
  // Option D: Brug pakke_start_energy KUN hvis > 0, ellers meter_start_energy
  const pakkeStartRaw = pakker[0]?.data?.pakke_start_energy;
  const pakkeStart = (pakkeStartRaw !== null && pakkeStartRaw !== undefined && pakkeStartRaw > 0)
    ? pakkeStartRaw
    : meterStartEnergy;
  const currentMeterUsage = Math.max(0, currentEnergy - pakkeStart);
  
  // Beregn ekstra måleres forbrug
  const extraMetersUsage = extraMeters.reduce((sum, extra) => {
    const reading = extraMeterReadings[extra.meter_id];
    if (reading) {
      return sum + Math.max(0, (reading.energy || 0) - (extra.meter_start_energy || 0));
    }
    return sum;
  }, 0);
  
  const totalActualUsage = accumulated + currentMeterUsage + extraMetersUsage;
  
  // Distribute usage: dagspakke first, then tillæg in order
  let remainingUsage = totalActualUsage;
  const pakkeUsages = new Map();
  
  // Sort: dagspakke first, then tillæg by creation date
  const sortedPakker = [...pakker].sort((a, b) => {
    const aIsDags = a.data.varighed_timer !== null && a.data.varighed_timer !== undefined;
    const bIsDags = b.data.varighed_timer !== null && b.data.varighed_timer !== undefined;
    if (aIsDags && !bIsDags) return -1;
    if (!aIsDags && bIsDags) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  
  sortedPakker.forEach(pakke => {
    const pakkeEnheder = parseFloat(pakke.data.enheder || '0');
    const usedFromThisPakke = Math.min(remainingUsage, pakkeEnheder);
    pakkeUsages.set(pakke.id, usedFromThisPakke);
    remainingUsage = Math.max(0, remainingUsage - usedFromThisPakke);
  });
  
  const totalUsage = totalActualUsage;
  const enhedRabLeft = Math.max(0, totalEnheder - totalUsage);
  const lowPower = pakker.length > 0 && enhedRabLeft <= 5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 animate-fade-in">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold truncate">
                  Velkommen, {guestSession?.booking_data?.fornavn || guestSession?.booking_data?.efternavn || "Gæst"}!
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Booking #{guestSession?.booking_nummer}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleSignOut} 
              size="sm"
              className="h-9 flex-shrink-0"
              aria-label="Log ud"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Log ud</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Not Checked In Info */}
        {!isCheckedIn && (
          <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950 animate-scale-in">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <Info className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-lg">
                      Velkommen til Jelling Camping!
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                      Du er ikke checked in endnu. Strømfunktioner vil være tilgængelige efter check-in.
                    </p>
                  </div>
                  {arrivalDate && (
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        <Calendar className="h-4 w-4 inline mr-2" />
                        Ankomst: {formatDanishDate(arrivalDate)}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Kommende funktioner (tilgængelige snart):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 bg-white dark:bg-gray-900 rounded p-2 border border-blue-200 dark:border-blue-800">
                        <Calendar className="h-4 w-4" />
                        <span>Kalender & aktiviteter</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 bg-white dark:bg-gray-900 rounded p-2 border border-blue-200 dark:border-blue-800">
                        <UtensilsCrossed className="h-4 w-4" />
                        <span>Bordbestilling</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Power Warning */}
        {isCheckedIn && lowPower && (
          <Card className="border-destructive bg-destructive/10 animate-scale-in">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive">Lav strøm!</p>
                    <p className="text-sm text-muted-foreground">
                      Kun {enhedRabLeft} kWh tilbage
                    </p>
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => navigate('/tillaegs-pakke')}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Køb tillægspakke
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ingen pakke - vis "Køb strømpakke" */}
        {isCheckedIn && maaler && pakker.length === 0 && (
          <Card className="border-primary bg-primary/5 animate-scale-in">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <Zap className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Kom i gang med strøm!</h3>
                  <p className="text-muted-foreground">
                    {kundeType === 'sæson' 
                      ? 'Køb din aktiverings pakke for at tænde måleren'
                      : 'Køb din første strømpakke for at tænde måleren'
                    }
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => navigate('/vaelg-pakke')}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {kundeType === 'sæson' ? 'Køb aktiverings pakke' : 'Køb dagspakke'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fejl: Måler er slettet */}
        {isCheckedIn && !maaler && pakker.length > 0 && (
          <Card className="border-destructive bg-destructive/10 animate-scale-in">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-destructive text-lg mb-2">
                    Måler ikke fundet
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Din tildelte måler er blevet slettet fra systemet. Kontakt venligst receptionen for at få tildelt en ny måler.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/vaelg-maaler')}
                    className="w-full sm:w-auto"
                  >
                    Vælg ny måler
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Måler Card - kun for checked-in gæster MED aktiv pakke */}
        {isCheckedIn && maaler && pakker.length > 0 && (
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Måler {maaler.meter_number}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${isPowerOn ? 'bg-green-500' : 'bg-red-500'}`} />
                {isPowerOn ? "Strøm tændt" : "Strøm slukket"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-12 sm:h-auto"
                  variant={isPowerOn ? "outline" : "default"}
                  onClick={() => togglePower(true)}
                  disabled={isTogglingPower || isPowerOn}
                  aria-label="Tænd for strøm"
                >
                  <Power className="h-4 w-4 mr-2" />
                  Tænd
                </Button>
                <Button
                  className="h-12 sm:h-auto"
                  variant={!isPowerOn ? "outline" : "destructive"}
                  onClick={() => togglePower(false)}
                  disabled={isTogglingPower || !isPowerOn}
                  aria-label="Sluk for strøm"
                >
                  <Power className="h-4 w-4 mr-2" />
                  Sluk
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Forbrug Oversigt - kun for checked-in gæster */}
        {isCheckedIn && pakker.length > 0 && (
          <div className="space-y-4 animate-fade-in">
            {/* Total Oversigt */}
            <Card className="bg-primary/10 border-2 border-primary">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Total Oversigt</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Total Forbrug:</span>
                    <span className="font-medium">{totalUsage.toFixed(2)} / {totalEnheder.toFixed(2)} enheder</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        (totalUsage / totalEnheder * 100) >= 90 ? 'bg-destructive' : 
                        (totalUsage / totalEnheder * 100) >= 70 ? 'bg-yellow-500' : 
                        'bg-primary'
                      }`}
                      style={{ width: `${Math.min((totalUsage / totalEnheder * 100), 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tilbage:</span>
                    <span className={`font-medium ${enhedRabLeft <= 0 ? 'text-destructive' : ''}`}>
                      {enhedRabLeft.toFixed(2)} enheder
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individuelle pakker */}
            {sortedPakker.map((pakke, index) => {
              const usage = pakkeUsages.get(pakke.id) || 0;
              const remaining = Math.max(0, parseFloat(pakke.data.enheder || '0') - usage);
              const percentUsed = pakke.data.enheder > 0 ? (usage / pakke.data.enheder) * 100 : 0;
              
              // Check if dagspakke is expired (for tillægspakker)
              const isDagspakke = pakke.data.varighed_timer !== null && pakke.data.varighed_timer !== undefined;
              const dagspakkeExpired = dagspakke && dagspakke.data.varighed_timer && 
                new Date().getTime() > new Date(dagspakke.created_at).getTime() + dagspakke.data.varighed_timer * 60 * 60 * 1000;
              const isTillægInactive = !isDagspakke && dagspakkeExpired;
              
              // Check if THIS dagspakke is expired
              const isDagspakkeExpired = isDagspakke && pakke.data.varighed_timer &&
                new Date().getTime() > new Date(pakke.created_at).getTime() + pakke.data.varighed_timer * 60 * 60 * 1000;
              
              return (
                <Card key={pakke.id} className={isTillægInactive ? "opacity-50" : ""}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">
                            {pakke.data?.varighed_timer 
                              ? pakke.data?.pakke_navn 
                              : `${parseFloat(pakke.data?.enheder || '0')} enheder (sæson)`}
                          </h3>
                          {!isTillægInactive && !isDagspakkeExpired && pakke.data?.status === 'aktiv' && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              AKTIV
                            </span>
                          )}
                          {isDagspakkeExpired && (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              UDLØBET
                            </span>
                          )}
                          {isTillægInactive && (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              INAKTIV
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-muted-foreground">
                            {usage.toFixed(2)} / {pakke.data.enheder} enheder
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {remaining.toFixed(2)} enheder tilbage
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, percentUsed)}%` }}
                        />
                      </div>
                      
                      {/* Udløbsdato */}
                      {isDagspakke && pakke.data.varighed_timer && (
                        <div className="text-sm text-muted-foreground">
                          Udløber: {new Date(new Date(pakke.created_at).getTime() + pakke.data.varighed_timer * 60 * 60 * 1000).toLocaleString('da-DK', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                      {!isDagspakke && (
                        <div className="text-sm text-muted-foreground">
                          {isTillægInactive 
                            ? (kundeType === 'sæson' 
                                ? "Inaktiv - køb ny aktiverings pakke for at aktivere"
                                : "Inaktiv - køb ny dagspakke for at aktivere")
                            : (kundeType === 'sæson'
                                ? "Aktiv indtil sæson afslutning"
                                : "Aktiv så længe dagspakke er aktiv")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}


        {/* Effekt og Spænding - kun for checked-in gæster */}
        {isCheckedIn && maaler && (
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Effekt */}
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-2">Effekt</div>
                <div className="text-3xl font-bold">{currentPower.toFixed(1)} W</div>
                <div className="text-xs text-muted-foreground mt-1">{currentCurrent.toFixed(2)} A</div>
              </div>
              
              {/* Spænding */}
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-2">Spænding</div>
                <div className="text-3xl font-bold">{Math.round(currentVoltage)} V</div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Ekstra Målere - vis kun hvis der er ekstra målere */}
        {isCheckedIn && extraMeters.length > 0 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Dine målere ({1 + extraMeters.length} stk)
              </CardTitle>
              <CardDescription>
                Alle målere deler din strømpakke
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primær måler */}
              {maaler && (
                <div className="p-4 border rounded-lg bg-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded">Primær</span>
                      <span className="font-medium">{maaler.meter_number}</span>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${isPowerOn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {isPowerOn ? 'TÆNDT' : 'SLUKKET'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Aktuelt</p>
                      <p className="font-bold flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {currentPower.toFixed(0)} W
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Forbrug</p>
                      <p className="font-medium">{currentMeterUsage.toFixed(2)} kWh</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Spænding</p>
                      <p className="font-medium">{Math.round(currentVoltage)} V</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ekstra målere */}
              {extraMeters.map((extra) => {
                const reading = extraMeterReadings[extra.meter_id];
                const extraUsage = reading ? Math.max(0, (reading.energy || 0) - (extra.meter_start_energy || 0)) : 0;
                const isOn = reading?.state === 'ON';
                const isToggling = togglingExtraMeter === extra.meter_id;
                return (
                  <div key={extra.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded">Ekstra</span>
                        <span className="font-medium">{extra.meter_id}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${isOn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {isOn ? 'TÆNDT' : 'SLUKKET'}
                      </span>
                    </div>
                    {reading ? (
                      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                        <div>
                          <p className="text-muted-foreground text-xs">Aktuelt</p>
                          <p className="font-bold flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {Number(reading.power || 0).toFixed(0)} W
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Forbrug</p>
                          <p className="font-medium">{extraUsage.toFixed(2)} kWh</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Spænding</p>
                          <p className="font-medium">{Math.round(reading.voltage || 0)} V</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-3">Ingen data</p>
                    )}
                    {/* Tænd/Sluk knapper for ekstra måler */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant={isOn ? "outline" : "default"}
                        onClick={() => toggleExtraMeterPower(extra.meter_id, true)}
                        disabled={isToggling || isOn}
                      >
                        <Power className="h-3 w-3 mr-1" />
                        Tænd
                      </Button>
                      <Button
                        size="sm"
                        variant={!isOn ? "outline" : "destructive"}
                        onClick={() => toggleExtraMeterPower(extra.meter_id, false)}
                        disabled={isToggling || !isOn}
                      >
                        <Power className="h-3 w-3 mr-1" />
                        Sluk
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Samlet effekt */}
              <div className="p-4 border-2 border-primary rounded-lg bg-primary/10">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Samlet aktuelt forbrug</span>
                  <span className="text-2xl font-bold">
                    {(currentPower + extraMeters.reduce((sum, e) => sum + Number(extraMeterReadings[e.meter_id]?.power || 0), 0)).toFixed(0)} W
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Buy Package Button - kun for checked-in gæster */}
        {isCheckedIn && (
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground animate-scale-in">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                {(() => {
                  // For sæson gæster: Tjek om der er NOGEN aktive pakker
                  if (kundeType === 'sæson') {
                    const harAktivPakke = pakker.some(p => p.data.status === 'aktiv');
                    if (harAktivPakke) {
                      return (
                        <>
                          <h3 className="text-lg sm:text-xl font-bold mb-1">Løbet tør for strøm?</h3>
                          <p className="opacity-90 text-sm sm:text-base">Køb mere strøm med få klik</p>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <h3 className="text-lg sm:text-xl font-bold mb-1">Kom i gang med strøm!</h3>
                          <p className="opacity-90 text-sm sm:text-base">Køb din aktiverings pakke for at tænde</p>
                        </>
                      );
                    }
                  }
                  
                  // For kørende gæster: Tjek om dagspakke er aktiv
                  const isDagspakkeActive = dagspakke && dagspakke.data.status === 'aktiv' && 
                    dagspakke.data.varighed_timer && 
                    new Date().getTime() < new Date(dagspakke.created_at).getTime() + dagspakke.data.varighed_timer * 60 * 60 * 1000;
                  
                  if (isDagspakkeActive) {
                    return (
                      <>
                        <h3 className="text-lg sm:text-xl font-bold mb-1">Løbet tør for strøm?</h3>
                        <p className="opacity-90 text-sm sm:text-base">Køb mere strøm med få klik</p>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <h3 className="text-lg sm:text-xl font-bold mb-1">Kom i gang med strøm!</h3>
                        <p className="opacity-90 text-sm sm:text-base">Køb din første strømpakke for at tænde</p>
                      </>
                    );
                  }
                })()}
              </div>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  // For sæson gæster: Tjek om der er aktive pakker
                  if (kundeType === 'sæson') {
                    const harAktivPakke = pakker.some(p => p.data.status === 'aktiv');
                    navigate(harAktivPakke ? '/tillaegs-pakke' : '/vaelg-pakke');
                    return;
                  }
                  
                  // For kørende gæster: Tjek om dagspakke er aktiv
                  const isDagspakkeActive = dagspakke && dagspakke.data.status === 'aktiv' && 
                    dagspakke.data.varighed_timer && 
                    new Date().getTime() < new Date(dagspakke.created_at).getTime() + dagspakke.data.varighed_timer * 60 * 60 * 1000;
                  
                  navigate(isDagspakkeActive ? '/tillaegs-pakke' : '/vaelg-pakke');
                }}
                className="w-full sm:w-auto h-12"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {(() => {
                  // For sæson gæster: Tjek om der er aktive pakker
                  if (kundeType === 'sæson') {
                    const harAktivPakke = pakker.some(p => p.data.status === 'aktiv');
                    return harAktivPakke ? 'Køb tillægspakke' : 'Køb aktiverings pakke';
                  }
                  
                  // For kørende gæster: Tjek om dagspakke er aktiv
                  const isDagspakkeActive = dagspakke && dagspakke.data.status === 'aktiv' && 
                    dagspakke.data.varighed_timer && 
                    new Date().getTime() < new Date(dagspakke.created_at).getTime() + dagspakke.data.varighed_timer * 60 * 60 * 1000;
                  
                  return isDagspakkeActive ? 'Køb tillægspakke' : 'Køb dagspakke';
                })()}
              </Button>
            </div>
          </CardContent>
        </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
