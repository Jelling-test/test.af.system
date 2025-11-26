import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Zap, ArrowLeft, ShoppingCart, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

const TillaegsPakke = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [guestSession, setGuestSession] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [maaler, setMaaler] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const sessionData = localStorage.getItem("guest_session");
      
      if (!sessionData) {
        navigate("/");
        return;
      }

      const session = JSON.parse(sessionData);
      setGuestSession(session);

      // Get kunde_type from booking data
      const kundeType = session.booking_data?.kunde_type || 'kørende';

      // Load tillægs pakker
      const { data: pakkeData, error: pakkeError } = await (supabase as any)
        .from('plugin_data')
        .select('*')
        .eq('organization_id', session.organization_id)
        .eq('module', 'pakke_typer')
        .eq('data->>kunde_type', kundeType)
        .eq('data->>pakke_kategori', 'tillæg')
        .eq('data->>aktiv', 'true')
        .order('data->>enheder', { ascending: true });

      if (pakkeError) throw pakkeError;
      setPackages(pakkeData || []);

      // Get måler info from regular_customers OR seasonal_customers
      let meterId = null;
      
      const { data: regularData } = await (supabase as any)
        .from('regular_customers')
        .select('meter_id')
        .eq('booking_id', session.booking_nummer)
        .maybeSingle();

      if (regularData?.meter_id) {
        meterId = regularData.meter_id;
      } else {
        // Tjek også seasonal_customers
        const { data: seasonalData } = await (supabase as any)
          .from('seasonal_customers')
          .select('meter_id')
          .eq('booking_id', session.booking_nummer)
          .maybeSingle();
        
        if (seasonalData?.meter_id) {
          meterId = seasonalData.meter_id;
        }
      }

      if (meterId) {
        setMaaler({ id: meterId });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse pakker",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !termsAccepted) return;

    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          organization_id: guestSession.organization_id,
          booking_nummer: guestSession.booking_nummer,
          pakke_type_id: selectedPackage.ref_id,
          maaler_id: maaler?.id || 'default',
        }
      });

      if (error) throw error;

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke starte betalingsprocessen",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const kundeType = guestSession?.booking_data?.kunde_type || 'kørende';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 animate-fade-in">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-2 min-h-[44px]"
            aria-label="Tilbage til dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Tilbage til dashboard</span>
            <span className="sm:hidden">Tilbage</span>
          </Button>
          <div className="flex items-center gap-3 animate-slide-up">
            <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Køb tillægspakke</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Udvid din strømkapacitet
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* Info Box */}
        <Card className="mb-6 md:mb-8 border-primary/20 bg-primary/5 animate-scale-in">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-sm sm:text-base">Om tillægspakker</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Tillægspakker lægges oveni din hovedpakke og giver dig ekstra enheder.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Package Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {packages.map((pkg) => {
            const isSelected = selectedPackage?.ref_id === pkg.ref_id;
            const enheder = pkg.data?.enheder || 0;
            const pris = pkg.data?.pris_dkk || pkg.data?.pris || 0;
            const navn = pkg.data?.navn || `${enheder} enheder`;

            return (
              <Card
                key={pkg.ref_id}
                className={`cursor-pointer transition-all hover:shadow-lg hover-scale animate-fade-in min-h-[44px] ${
                  isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                }`}
                onClick={() => setSelectedPackage(pkg)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPackage(pkg);
                  }
                }}
              >
                <CardHeader>
                  <CardTitle className="text-3xl font-bold text-primary">
                    {enheder}
                  </CardTitle>
                  <CardDescription className="text-base">
                    enheder
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="text-2xl font-bold">{pris} kr</div>
                  </div>
                  <Button
                    className="w-full min-h-[44px]"
                    variant={isSelected ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPackage(pkg);
                    }}
                    aria-label={`Vælg ${enheder} enheder for ${pris} kr`}
                  >
                    {isSelected ? 'Valgt' : 'Vælg'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {packages.length === 0 && (
          <Card className="animate-fade-in">
            <CardContent className="p-8 md:p-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">
                Ingen tillægspakker tilgængelige for {kundeType} gæster
              </p>
            </CardContent>
          </Card>
        )}

        {/* Selected Package & Purchase */}
        {selectedPackage && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 animate-scale-in">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">
                    Du har valgt: {selectedPackage.data?.enheder} enheder
                  </h3>
                  <p className="text-xl sm:text-2xl font-bold text-primary">
                    {selectedPackage.data?.pris_dkk || selectedPackage.data?.pris} kr
                  </p>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3 p-4 bg-background rounded-lg">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    aria-label="Accepter vilkår"
                  />
                  <label
                    htmlFor="terms"
                    className="text-xs sm:text-sm cursor-pointer leading-relaxed"
                  >
                    Jeg accepterer vilkårene: {kundeType === 'kørende' 
                      ? 'Tillægspakken lægges oveni din hovedpakke. Ubrugte enheder forsvinder ved pakkeudløb. Ingen refundering.'
                      : 'Tillægspakken lægges oveni din hovedpakke. Ubrugte enheder forsvinder ved checkout. Ingen refundering.'}
                  </label>
                </div>

                {/* Purchase Button */}
                <Button
                  className="w-full min-h-[44px]"
                  size="lg"
                  onClick={handlePurchase}
                  disabled={!termsAccepted || isPurchasing}
                  aria-label="Køb tillægspakke"
                >
                  {isPurchasing ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      <span>Starter betaling...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      <span>Køb nu</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default TillaegsPakke;
