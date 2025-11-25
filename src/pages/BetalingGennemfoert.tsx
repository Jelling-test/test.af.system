import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Zap, AlertCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BetalingGennemfoert = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationError, setVerificationError] = useState(false);
  const sessionId = searchParams.get('session_id');
  const shouldNavigate = useRef(false);

  useEffect(() => {
    // Verify guest session
    const sessionData = localStorage.getItem("guest_session");
    if (!sessionData) {
      navigate("/");
      return;
    }

    if (!sessionId) {
      console.error("No session ID provided");
      setVerificationError(true);
      setIsLoading(false);
      return;
    }

    const verifyPayment = async () => {
      try {
        const guestSession = JSON.parse(sessionData);

        // Wait a bit for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify that package was created by checking betalinger
        const { data: payment, error } = await (supabase as any)
          .from("plugin_data")
          .select("*")
          .eq("organization_id", guestSession.organization_id)
          .eq("module", "betalinger")
          .eq("data->>stripe_session_id", sessionId)
          .maybeSingle();

        if (error) {
          console.error("Error verifying payment:", error);
          setVerificationError(true);
          setIsLoading(false);
          return;
        }

        if (!payment) {
          console.warn("Payment not found yet, webhook may still be processing");
          // Don't show error, webhook might still be processing
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error in payment verification:", error);
        setVerificationError(true);
        setIsLoading(false);
      }
    };

    verifyPayment();
  }, [navigate, sessionId]);

  // Separate useEffect for countdown timer
  useEffect(() => {
    if (isLoading || verificationError) return;

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          shouldNavigate.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [isLoading, verificationError]);

  // Separate useEffect for navigation
  useEffect(() => {
    if (shouldNavigate.current) {
      navigate("/dashboard");
    }
  }, [countdown, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4 animate-fade-in">
        <Card className="w-full max-w-md border-yellow-200 shadow-lg animate-scale-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-16 w-16 sm:h-20 sm:w-20 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl text-yellow-700">Betaling behandles</CardTitle>
            <CardDescription className="text-sm sm:text-base mt-2">
              Din betaling er modtaget og behandles. Pakken aktiveres om få øjeblikke.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Hvis din pakke ikke aktiveres inden for 2 minutter, kontakt venligst receptionen.
              </p>
            </div>
            <Button 
              onClick={() => navigate("/dashboard")}
              className="w-full min-h-[44px]"
              size="lg"
            >
              Gå til dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4 animate-fade-in">
      <Card className="w-full max-w-md border-green-200 shadow-lg animate-scale-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <CheckCircle className="h-16 w-16 sm:h-20 sm:w-20 text-green-600 animate-in zoom-in duration-500" aria-hidden="true" />
              <div className="absolute inset-0 bg-green-600/20 rounded-full animate-ping" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl text-green-700">Betaling gennemført!</CardTitle>
          <CardDescription className="text-sm sm:text-base mt-2">
            Din pakke er nu aktiv og klar til brug
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Din strøm er aktiveret</p>
                <p className="text-sm text-green-700">
                  Du kan nu begynde at bruge dine enheder
                </p>
              </div>
            </div>
          </div>

          {sessionId && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Reference: {sessionId.slice(0, 20)}...
              </p>
            </div>
          )}

          <div className="text-center space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground" role="timer" aria-live="polite">
              Omdirigerer til dashboard om <span className="font-bold text-foreground">{countdown}</span> sekunder...
            </p>
            <Button 
              onClick={() => navigate("/dashboard")}
              className="w-full min-h-[44px]"
              size="lg"
              aria-label="Gå til dashboard nu"
            >
              Gå til dashboard nu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BetalingGennemfoert;
