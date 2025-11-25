import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Zap, Check, ShoppingCart } from "lucide-react";

interface Package {
  id: string;
  ref_id: string;
  type_id: string;
  navn: string;
  enheder: number;
  varighed_dage?: number;
  varighed_timer?: number;
  pris: number;
  beskrivelse?: string;
}

const VaelgPakke = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [guestSession, setGuestSession] = useState<any>(null);
  const [kundeType, setKundeType] = useState<"kørende" | "sæson" | null>(null);
  const [maalerId, setMaalerId] = useState<string | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [activeTab, setActiveTab] = useState("1-7");

  useEffect(() => {
    checkSessionAndLoadPackages();
  }, []);

  const checkSessionAndLoadPackages = async () => {
    try {
      const sessionData = localStorage.getItem("guest_session");
      
      if (!sessionData) {
        navigate("/");
        return;
      }

      const session = JSON.parse(sessionData);
      setGuestSession(session);

      // Get kunde_type from booking data
      const bookingKundeType = session.booking_data?.kunde_type;
      if (!bookingKundeType) {
        toast({
          title: "Fejl",
          description: "Kunde type ikke fundet i booking data",
          variant: "destructive",
        });
        return;
      }
      setKundeType(bookingKundeType);

      // Check if meter is assigned in new tables
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

      if (!customer?.meter_id) {
        // No meter assigned, redirect back
        navigate("/vaelg-maaler");
        return;
      }

      setMaalerId(customer.meter_id);

      // Load packages
      const packagesResponse = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", session.organization_id)
        .eq("module", "pakke_typer");

      if (packagesResponse.data) {
        const filteredPackages = packagesResponse.data
          .filter((item: any) => {
            const data = item.data;
            // For kørende: vis dagspakker, for sæson: vis startpakker
            const expectedKategori = bookingKundeType === 'kørende' ? 'dagspakke' : 'startpakke';
            return (
              data?.kunde_type === bookingKundeType &&
              data?.pakke_kategori === expectedKategori &&
              (data?.aktiv === 'true' || data?.aktiv === true)
            );
          })
          .map((item: any) => {
            const data = item.data;
            return {
              id: item.id,
              ref_id: item.ref_id,
              type_id: data.type_id || item.ref_id,
              navn: data.navn || "",
              enheder: parseInt(data.enheder) || 0,
              varighed_dage: data.varighed_dage ? parseInt(data.varighed_dage) : undefined,
              varighed_timer: data.varighed_timer ? parseInt(data.varighed_timer) : undefined,
              pris: parseFloat(data.pris_dkk || data.pris) || 0,
              beskrivelse: data.beskrivelse || "",
            };
          })
          .sort((a: Package, b: Package) => a.enheder - b.enheder);

        setPackages(filteredPackages);
      }
    } catch (error) {
      console.error("Error loading packages:", error);
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const getPackagesForTab = (tab: string): Package[] => {
    if (kundeType === "sæson") return packages;

    switch (tab) {
      case "1-7":
        return packages.filter((p) => p.enheder >= 10 && p.enheder <= 70);
      case "8-14":
        return packages.filter((p) => p.enheder >= 80 && p.enheder <= 140);
      case "15-21":
        return packages.filter((p) => p.enheder >= 150 && p.enheder <= 210);
      default:
        return [];
    }
  };

  const getTermsText = (): string => {
    if (kundeType === "kørende") {
      // Brug varighed_timer hvis den findes, ellers beregn fra varighed_dage
      const hours = selectedPackage?.varighed_timer || (selectedPackage?.varighed_dage ? selectedPackage.varighed_dage * 24 : 0);
      return `Pakken udløber efter ${hours} timer. Ubrugte enheder forsvinder. Ingen refundering.`;
    }
    return "Pakken gælder hele sæsonen. Ubrugte enheder forsvinder ved checkout.";
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !guestSession || !maalerId) return;

    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          organization_id: guestSession.organization_id,
          booking_nummer: guestSession.booking_nummer,
          pakke_type_id: selectedPackage.type_id,
          maaler_id: maalerId,
        },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("Ingen checkout URL modtaget");
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved oprettelse af betaling. Prøv venligst igen.",
        variant: "destructive",
      });
      setIsPurchasing(false);
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
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="mb-6 sm:mb-8 animate-slide-up">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Vælg strømpakke</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            {kundeType === "kørende"
              ? "Vælg den pakke der passer til dit ophold"
              : "Vælg din sæsonpakke"}
          </p>
        </div>

        {kundeType === "kørende" ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6 sm:mb-8">
            <TabsList className="grid w-full grid-cols-3 mb-6 sm:mb-8 h-auto">
              <TabsTrigger value="1-7" className="h-11 text-sm sm:text-base">1-7 dage</TabsTrigger>
              <TabsTrigger value="8-14" className="h-11 text-sm sm:text-base">8-14 dage</TabsTrigger>
              <TabsTrigger value="15-21" className="h-11 text-sm sm:text-base">15-21 dage</TabsTrigger>
            </TabsList>

            {["1-7", "8-14", "15-21"].map((tab) => (
              <TabsContent key={tab} value={tab} className="animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  {getPackagesForTab(tab).map((pkg) => (
                    <Card
                      key={pkg.id}
                      className={`cursor-pointer transition-all hover-scale ${
                        selectedPackage?.id === pkg.id
                          ? "border-2 border-primary bg-primary/5 shadow-lg"
                          : "hover:border-primary/50 hover:shadow-md"
                      }`}
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setTermsAccepted(false);
                      }}
                      role="radio"
                      aria-checked={selectedPackage?.id === pkg.id}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedPackage(pkg);
                          setTermsAccepted(false);
                        }
                      }}
                    >
                      <CardHeader className="space-y-3">
                        <CardTitle className="text-2xl sm:text-3xl font-bold text-center leading-tight">
                          ⚡ {(() => {
                            const hours = pkg.varighed_timer || (pkg.varighed_dage ? pkg.varighed_dage * 24 : 0);
                            const days = Math.floor(hours / 24);
                            if (days > 0 && hours % 24 === 0) {
                              return `${days} DAG${days > 1 ? 'E' : ''}`;
                            }
                            return `${hours} TIMER`;
                          })()} ⚡
                        </CardTitle>
                        <CardDescription className="text-center text-sm sm:text-base font-semibold">
                          (aktiv i {pkg.varighed_timer || (pkg.varighed_dage ? pkg.varighed_dage * 24 : 0)} timer fra start)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-center">
                          <p className="text-lg sm:text-xl font-bold">
                            🔹 Indeholder {pkg.enheder} enheder 🔹
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl sm:text-3xl font-bold text-primary">
                            💰 {pkg.pris.toFixed(2)} kr
                          </p>
                        </div>
                        <Button
                          variant={selectedPackage?.id === pkg.id ? "default" : "outline"}
                          className="w-full h-11"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPackage(pkg);
                            setTermsAccepted(false);
                          }}
                          aria-label={`Vælg ${pkg.enheder} enheder pakke for ${pkg.pris} kroner`}
                        >
                          {selectedPackage?.id === pkg.id ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Valgt
                            </>
                          ) : (
                            "Vælg pakke"
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8 animate-fade-in">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`cursor-pointer transition-all hover-scale ${
                  selectedPackage?.id === pkg.id
                    ? "border-2 border-primary bg-primary/5 shadow-lg"
                    : "hover:border-primary/50 hover:shadow-md"
                }`}
                onClick={() => {
                  setSelectedPackage(pkg);
                  setTermsAccepted(false);
                }}
                role="radio"
                aria-checked={selectedPackage?.id === pkg.id}
                tabIndex={0}
              >
                <CardHeader className="space-y-3">
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-center leading-tight">
                    ⚡ AKTIVERINGS PAKKE ⚡
                  </CardTitle>
                  <CardDescription className="text-center text-sm sm:text-base font-semibold">
                    (aktiv til checkout)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold">
                      🔹 Indeholder {pkg.enheder} enheder 🔹
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-bold text-primary">
                      💰 {pkg.pris.toFixed(2)} kr
                    </p>
                  </div>
                  <Button
                    variant={selectedPackage?.id === pkg.id ? "default" : "outline"}
                    className="w-full h-11"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPackage(pkg);
                      setTermsAccepted(false);
                    }}
                    aria-label={`Vælg ${pkg.enheder} enheder pakke for ${pkg.pris} kroner`}
                  >
                    {selectedPackage?.id === pkg.id ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Valgt
                      </>
                    ) : (
                      "Vælg pakke"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Terms & Purchase */}
        {selectedPackage && (
          <Card className="border-2 border-primary animate-scale-in">
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-1 h-5 w-5"
                  aria-label="Accepter vilkår"
                />
                <div className="flex-1">
                  <label
                    htmlFor="terms"
                    className="text-sm sm:text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Jeg accepterer vilkårene
                  </label>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-bold">{getTermsText()}</p>
                </div>
              </div>

              <Button
                onClick={handlePurchase}
                disabled={!termsAccepted || isPurchasing}
                className="w-full h-12 sm:h-14 text-base sm:text-lg"
                size="lg"
                aria-label={`Køb ${selectedPackage.navn} pakke for ${selectedPackage.pris} kroner`}
              >
                {isPurchasing ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span>Omdirigerer til betaling...</span>
                  </div>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Køb nu - {selectedPackage.pris.toFixed(2)} kr
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default VaelgPakke;
