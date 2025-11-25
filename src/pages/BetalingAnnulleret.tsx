import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, ArrowLeft, RotateCcw, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BetalingAnnulleret = () => {
  const navigate = useNavigate();
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const incrementFailedAttempts = async () => {
      try {
        const sessionData = localStorage.getItem("guest_session");
        if (!sessionData) {
          navigate("/");
          return;
        }

        const session = JSON.parse(sessionData);
        const bookingId = session.booking_nummer;

        // Tjek om kunden er kørende eller sæson
        const { data: regularCustomer } = await (supabase as any)
          .from('regular_customers')
          .select('id, payment_failed_attempts')
          .eq('booking_id', bookingId)
          .maybeSingle();

        const { data: seasonalCustomer } = await (supabase as any)
          .from('seasonal_customers')
          .select('id, payment_failed_attempts')
          .eq('booking_id', bookingId)
          .maybeSingle();

        const customer = regularCustomer || seasonalCustomer;
        const table = regularCustomer ? 'regular_customers' : 'seasonal_customers';

        if (customer) {
          const currentAttempts = customer.payment_failed_attempts || 0;
          const newAttempts = currentAttempts + 1;

          // Opdater antal fejlede forsøg
          await (supabase as any)
            .from(table)
            .update({ 
              payment_failed_attempts: newAttempts,
              updated_at: new Date().toISOString()
            })
            .eq('id', customer.id);

          setFailedAttempts(newAttempts);
        }
      } catch (error) {
        console.error("Error incrementing failed attempts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    incrementFailedAttempts();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4">
        <Card className="w-full max-w-md border-blue-200">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Behandler...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Efter 2 fejlede forsøg - vis "Kontakt reception"
  if (failedAttempts >= 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4 animate-fade-in">
        <Card className="w-full max-w-md border-orange-200 animate-scale-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Phone className="h-16 w-16 sm:h-20 sm:w-20 text-orange-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl text-orange-700">Kontakt receptionen</CardTitle>
            <CardDescription className="text-sm sm:text-base mt-2">
              Du har haft {failedAttempts} fejlede betalingsforsøg
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-900 text-center font-semibold">
                Kontakt venligst receptionen for hjælp med betaling
              </p>
              <p className="text-xs text-orange-700 text-center mt-2">
                Receptionen kan hjælpe dig med at løse betalingsproblemer og aktivere din strømpakke
              </p>
            </div>

            <Button 
              onClick={() => navigate("/dashboard")}
              className="w-full min-h-[44px]"
              size="lg"
              aria-label="Gå til dashboard"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span>Gå til dashboard</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal annullerings-side (1. forsøg)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4 animate-fade-in">
      <Card className="w-full max-w-md border-blue-200 animate-scale-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Info className="h-16 w-16 sm:h-20 sm:w-20 text-blue-600" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl text-blue-700">Betaling annulleret</CardTitle>
          <CardDescription className="text-sm sm:text-base mt-2">
            Din betaling blev ikke gennemført
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 text-center">
              Du kan prøve igen eller købe en pakke senere
            </p>
            {failedAttempts === 1 && (
              <p className="text-xs text-blue-700 text-center mt-2">
                Bemærk: Efter endnu et fejlet forsøg skal du kontakte receptionen
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => navigate("/dashboard")}
              className="w-full min-h-[44px]"
              size="lg"
              aria-label="Gå til dashboard"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span>Gå til dashboard</span>
            </Button>
            
            <Button 
              onClick={() => navigate("/vaelg-pakke")}
              variant="outline"
              className="w-full min-h-[44px]"
              size="lg"
              aria-label="Prøv igen"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              <span>Prøv igen</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BetalingAnnulleret;
