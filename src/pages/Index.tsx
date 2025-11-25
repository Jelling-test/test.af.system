import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [bookingNummer, setBookingNummer] = useState("");
  const [efternavn, setEfternavn] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Validate inputs
      if (!bookingNummer.trim() || !efternavn.trim()) {
        setError("Begge felter er påkrævet");
        setIsLoading(false);
        return;
      }

      const bookingId = parseInt(bookingNummer.trim());
      if (isNaN(bookingId)) {
        setError("Ugyldigt booking nummer");
        setIsLoading(false);
        return;
      }

      // Try regular_customers first
      let { data: regularCustomer } = await (supabase as any)
        .from("regular_customers")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();

      // If not found, try seasonal_customers
      let { data: seasonalCustomer } = await (supabase as any)
        .from("seasonal_customers")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();

      const customer = regularCustomer || seasonalCustomer;

      if (!customer) {
        setError("Ugyldigt booking nummer eller efternavn");
        setIsLoading(false);
        return;
      }

      // Check last name
      if (customer.last_name?.toLowerCase() !== efternavn.trim().toLowerCase()) {
        setError("Ugyldigt booking nummer eller efternavn");
        setIsLoading(false);
        return;
      }

      // Create booking data object for compatibility
      const bookingData = {
        booking_nummer: customer.booking_id.toString(),
        fornavn: customer.first_name,
        efternavn: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        kunde_type: customer.customer_type || (regularCustomer ? "kørende" : "sæson"),
        checked_in: customer.checked_in,
        check_in: customer.arrival_date,
        check_out: customer.departure_date,
        spot_number: customer.spot_number,
        meter_id: customer.meter_id,
      };

      // Store session in localStorage
      const guestSession = {
        type: "guest",
        booking_nummer: bookingId.toString(),
        organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        booking_data: bookingData,
      };

      localStorage.setItem("guest_session", JSON.stringify(guestSession));

      toast({
        title: "Login succesfuld",
        description: `Velkommen, ${customer.first_name} ${customer.last_name}`,
      });

      // Redirect to guest dashboard
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Der opstod en fejl. Prøv venligst igen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary animate-scale-in">
            <Zap className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl sm:text-3xl font-bold">
              Strømportal - Jelling Camping
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              Log ind med dit booking nummer og efternavn
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="booking-nummer" className="text-base">Booking nummer</Label>
                <Input
                  id="booking-nummer"
                  type="text"
                  placeholder="f.eks. 41967"
                  value={bookingNummer}
                  onChange={(e) => {
                    setBookingNummer(e.target.value);
                    setError("");
                  }}
                  required
                  disabled={isLoading}
                  className="h-12 text-base"
                  aria-label="Indtast dit booking nummer"
                  aria-describedby={error ? "error-message" : undefined}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="efternavn" className="text-base">Efternavn</Label>
                <Input
                  id="efternavn"
                  type="text"
                  placeholder="f.eks. Jensen"
                  value={efternavn}
                  onChange={(e) => {
                    setEfternavn(e.target.value);
                    setError("");
                  }}
                  required
                  disabled={isLoading}
                  className="h-12 text-base"
                  aria-label="Indtast dit efternavn"
                  aria-describedby={error ? "error-message" : undefined}
                />
              </div>
            </div>

            {error && (
              <div 
                id="error-message"
                role="alert"
                className="rounded-md bg-destructive/10 border border-destructive/20 p-3 animate-fade-in"
              >
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={isLoading || !bookingNummer.trim() || !efternavn.trim()}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span>Logger ind...</span>
                </div>
              ) : (
                "Log ind"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Har du problemer med at logge ind?
              </p>
              <p className="text-sm text-muted-foreground">
                Having trouble logging in?
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Kontakt receptionen på{" "}
                <a href="tel:81826300" className="font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded">
                  tlf. 8182 6300 - tast 1
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
                Contact reception at{" "}
                <a href="tel:81826300" className="font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded">
                  phone 8182 6300 - press 1
                </a>
              </p>
            </div>
            
            <div className="pt-4 border-t space-y-2">
              <Button
                variant="link"
                onClick={() => navigate("/staff/login")}
                className="text-sm hover-scale focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                aria-label="Gå til personale login"
              >
                Personale login →
              </Button>
              <div>
                <Button
                  variant="link"
                  onClick={() => navigate("/admin/login")}
                  className="text-sm hover-scale focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  aria-label="Gå til administrator login"
                >
                  Administrator login →
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
