import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Search, Zap, Check } from "lucide-react";

interface Meter {
  id: string;
  meter_number: string;
  spot_number: string | null;
}

const VaelgMaaler = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [guestSession, setGuestSession] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Meter[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    checkSessionAndMeter();
  }, []);

  const checkSessionAndMeter = async () => {
    try {
      const sessionData = localStorage.getItem("guest_session");
      
      if (!sessionData) {
        navigate("/");
        return;
      }

      const session = JSON.parse(sessionData);
      setGuestSession(session);

      // Check if guest already has a meter assigned
      const bookingId = parseInt(session.booking_nummer);
      
      let { data: customer } = await (supabase as any)
        .from('regular_customers')
        .select('meter_id')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (!customer) {
        const { data: seasonalCustomer } = await (supabase as any)
          .from('seasonal_customers')
          .select('meter_id')
          .eq('booking_id', bookingId)
          .maybeSingle();
        customer = seasonalCustomer;
      }

      if (customer?.meter_id) {
        // Meter already assigned, skip to next page
        navigate("/vaelg-pakke");
        return;
      }
    } catch (error) {
      console.error("Error checking session:", error);
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search function
  const searchMeters = useCallback(
    async (query: string) => {
      if (!query.trim() || !guestSession) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        // Get meters that match search and are marked available
        const { data: meters, error } = await (supabase as any)
          .from('power_meters')
          .select('*')
          .eq('is_available', true)
          .ilike('meter_number', `%${query}%`)
          .limit(10);

        if (error) throw error;

        // HYTTE-FILTER: Hent alle målere der er låst til hytter
        const { data: cabinMeters } = await (supabase as any)
          .from('cabins')
          .select('meter_id')
          .not('meter_id', 'is', null);

        const cabinMeterIds = new Set(cabinMeters?.map((c: any) => c.meter_id) || []);

        // Get all assigned meter IDs from customers (both UUID and direct)
        const { data: seasonalCustomers } = await (supabase as any)
          .from('seasonal_customers')
          .select('meter_id')
          .eq('checked_in', true)
          .not('meter_id', 'is', null);

        const { data: regularCustomers } = await (supabase as any)
          .from('regular_customers')
          .select('meter_id')
          .eq('checked_in', true)
          .not('meter_id', 'is', null);

        // Create set of assigned meter UUIDs
        const assignedMeterIds = new Set([
          ...(seasonalCustomers?.map(c => c.meter_id) || []),
          ...(regularCustomers?.map(c => c.meter_id) || []),
        ]);

        // Filter meters that are online (is_online from Z2M) AND not assigned
        const availableOnlineMeters = (meters || [])
          .filter((meter: any) => {
            // Skip if meter is assigned to a customer
            if (assignedMeterIds.has(meter.meter_number)) {
              return false;
            }

            // HYTTE-FILTER: Skip hvis måler er låst til en hytte
            if (cabinMeterIds.has(meter.meter_number)) {
              return false;
            }

            // Only include meter if it is online (from Z2M availability)
            return meter.is_online === true;
          })
          .map((meter: any) => ({
            id: meter.id,
            meter_number: meter.meter_number,
            spot_number: meter.spot_number,
          }));

        const formattedMeters = availableOnlineMeters.filter(m => m !== null) as Meter[];

        setSearchResults(formattedMeters);
        setShowDropdown(formattedMeters.length > 0);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [guestSession]
  );

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchMeters(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchMeters]);

  const handleSelectMeter = (meter: Meter) => {
    setSelectedMeter(meter);
    setSearchQuery(meter.meter_number);
    setShowDropdown(false);
  };

  const handleConfirm = async () => {
    if (!selectedMeter || !guestSession) return;

    setIsConfirming(true);
    try {
      const bookingId = parseInt(guestSession.booking_nummer);

      // Get current meter reading for start energy
      const { data: meterReading } = await (supabase as any)
        .from('meter_readings')
        .select('energy, time')
        .eq('meter_id', selectedMeter.meter_number)
        .order('time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const startEnergy = meterReading?.energy || 0;
      const startTime = meterReading?.time || new Date().toISOString();

      // Update customer with meter
      let { data: customer } = await (supabase as any)
        .from('regular_customers')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();

      let tableName = 'regular_customers';
      if (!customer) {
        const { data: seasonalCustomer } = await (supabase as any)
          .from('seasonal_customers')
          .select('id')
          .eq('booking_id', bookingId)
          .maybeSingle();
        customer = seasonalCustomer;
        tableName = 'seasonal_customers';
      }

      if (!customer) throw new Error('Customer not found');

      // Update customer with meter
      const meterIdValue = selectedMeter.meter_number;
      
      const { error: updateCustomerError } = await (supabase as any)
        .from(tableName)
        .update({
          meter_id: meterIdValue,
          meter_start_energy: startEnergy,
          meter_start_time: startTime,
          updated_at: new Date().toISOString(),
        })
        .eq('booking_id', bookingId);

      if (updateCustomerError) throw updateCustomerError;

      // Update meter as unavailable
      const { error: updateMeterError } = await (supabase as any)
        .from('power_meters')
        .update({
          is_available: false,
          current_customer_id: customer.id,
          updated_at: new Date().toISOString(),
        })
        .eq('meter_number', selectedMeter.meter_number);

      if (updateMeterError) throw updateMeterError;

      toast({
        title: "Måler bekræftet",
        description: `Måler ${selectedMeter.meter_number} er nu tildelt til din booking`,
      });

      // Redirect to package selection
      navigate("/vaelg-pakke");
    } catch (error: any) {
      console.error("Confirm error:", error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl. Prøv venligst igen.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 animate-fade-in">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 animate-fade-in">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 backdrop-blur-sm bg-card/95">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center gap-2">
          <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-lg sm:text-2xl font-bold">Jelling Camping - Strømportal</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-2xl">
        <div className="mb-6 sm:mb-8 animate-slide-up">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Vælg din strømmåler</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Søg efter din standers nummer (f.eks. 5, 12, 150)
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Indtast stander nummer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                setSelectedMeter(null);
              }}
              className="pl-12 h-12 sm:h-14 text-base sm:text-lg"
              aria-label="Søg efter strømmåler"
              aria-describedby="search-help"
              autoComplete="off"
            />
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && (
            <Card className="absolute w-full mt-2 z-50 shadow-lg border-2 animate-fade-in">
              <CardContent className="p-0">
                {isSearching ? (
                  <div className="p-4 flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-muted-foreground">Søger...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <ul className="divide-y max-h-[300px] overflow-y-auto" role="listbox">
                    {searchResults.map((meter) => (
                      <li key={meter.id} role="option">
                        <button
                          onClick={() => handleSelectMeter(meter)}
                          className="w-full p-4 text-left hover:bg-accent transition-colors flex items-center gap-3 focus:outline-none focus:bg-accent"
                          aria-label={`Vælg måler ${meter.meter_number}`}
                        >
                          <Zap className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="font-medium">Måler {meter.meter_number}</span>
                          {meter.spot_number && (
                            <span className="text-sm text-muted-foreground">• Plads {meter.spot_number}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    Ingen ledige målere fundet
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Selected Meter Confirmation */}
        {selectedMeter && !showDropdown && (
          <Card className="border-2 border-primary bg-primary/5 mb-6 animate-scale-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Check className="h-6 w-6 text-success" />
                Valgt måler
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Du har valgt følgende strømmåler
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-card rounded-lg p-4 sm:p-6 mb-4">
                <div className="flex items-center gap-3">
                  <Zap className="h-8 w-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">Måler {selectedMeter.meter_number}</p>
                    {selectedMeter.spot_number && (
                      <p className="text-sm text-muted-foreground">Plads {selectedMeter.spot_number}</p>
                    )}
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Booking: {guestSession?.booking_nummer}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="w-full h-12 sm:h-14 text-base sm:text-lg bg-success hover:bg-success/90"
                size="lg"
                aria-label={`Bekræft valg af måler ${selectedMeter.meter_number}`}
              >
                {isConfirming ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span>Bekræfter...</span>
                  </div>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Bekræft valg
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Help Text */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="font-semibold mb-2 text-sm sm:text-base" id="search-help">Sådan finder du dit stander nummer:</h3>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>• Stander nummeret står på din strømboks</li>
              <li>• Indtast kun tallet (f.eks. 5, 12, eller 150)</li>
              <li>• Du kan søge efter starten af nummeret</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default VaelgMaaler;
