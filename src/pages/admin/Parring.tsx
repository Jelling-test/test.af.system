import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Radio,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  RefreshCw,
} from "lucide-react";

// NAS Service URL - skal matche din NAS IP
const PAIRING_SERVICE_URL = "http://192.168.9.61:3001";

type PairingStep = 
  | "idle"           // Venter på bruger
  | "waiting"        // Venter på enhed
  | "joined"         // Enhed fundet
  | "interviewing"   // Interview i gang
  | "ready"          // Klar til navngivning
  | "testing"        // Tester relæ
  | "failed"         // Interview fejlet
  | "success";       // Færdig

interface Area {
  id: string;
  name: string;
  baseTopic: string;
}

interface DeviceInfo {
  ieee_address: string;
  friendly_name?: string;
  model?: string;
  vendor?: string;
}

const Parring = () => {
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);
  
  const [step, setStep] = useState<PairingStep>("idle");
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [newName, setNewName] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Hent tilgængelige områder ved mount
  useEffect(() => {
    fetchAreas();
    return () => {
      disconnectSSE();
    };
  }, []);

  const fetchAreas = async () => {
    try {
      const response = await fetch(`${PAIRING_SERVICE_URL}/pairing/areas`);
      const data = await response.json();
      if (data.success) {
        setAreas(data.areas);
        if (data.areas.length > 0) {
          setSelectedArea(data.areas[0].baseTopic);
        }
      }
    } catch (err) {
      console.error("Kunne ikke hente områder:", err);
      setError("Kunne ikke forbinde til pairing service. Er NAS online?");
    }
  };

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${PAIRING_SERVICE_URL}/pairing/events`);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("SSE connected");
      setIsConnected(true);
      setError(null);
    };

    es.onerror = () => {
      console.error("SSE error");
      setIsConnected(false);
      setError("Forbindelse til pairing service tabt");
    };

    es.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleSSEMessage(message);
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    };
  }, []);

  const disconnectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  const handleSSEMessage = (message: { event: string; data: any }) => {
    console.log("SSE Event:", message.event, message.data);

    switch (message.event) {
      case "connected":
        // Initial state
        break;

      case "pairing_started":
        setStep("waiting");
        toast.info(`Parringstilstand aktiveret på ${message.data.baseTopic}`);
        break;

      case "device_joined":
        setDeviceInfo({
          ieee_address: message.data.ieee_address,
          friendly_name: message.data.friendly_name,
        });
        setStep("joined");
        toast.success("Ny enhed fundet!");
        break;

      case "interview_started":
        setStep("interviewing");
        break;

      case "interview_successful":
        setDeviceInfo((prev) => ({
          ...prev!,
          model: message.data.model,
          vendor: message.data.vendor,
        }));
        setStep("ready");
        toast.success("Interview fuldført! Klar til navngivning.");
        break;

      case "interview_failed":
        setStep("failed");
        toast.error("Interview fejlede. Enheden kunne ikke konfigureres.");
        break;

      case "pairing_stopped":
        if (step === "waiting") {
          setStep("idle");
        }
        break;

      case "rename_response":
        if (message.data.status === "ok") {
          toast.success(`Måler omdøbt til "${newName}"`);
          // Relay test will start automatically - wait for it
        } else {
          toast.error("Kunne ikke omdøbe måler: " + (message.data.error || "Ukendt fejl"));
        }
        break;

      case "relay_command_sent":
        if (message.data.state === "OFF") {
          toast.info("Relæ slukket - se efter lyset slukker");
        } else {
          toast.success("Relæ tændt!");
        }
        break;

      case "relay_test_complete":
        setTestResult(message.data.success);
        setStep("success");
        if (message.data.success) {
          toast.success("Måler testet: OK!");
        } else {
          toast.error("Måler test fejlede!");
        }
        // Stop pairing after short delay
        setTimeout(() => {
          stopPairing();
        }, 500);
        break;
    }
  };

  const startPairing = async () => {
    if (!selectedArea) {
      toast.error("Vælg et område først");
      return;
    }

    setError(null);
    connectSSE();

    try {
      const response = await fetch(`${PAIRING_SERVICE_URL}/pairing/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseTopic: selectedArea }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Kunne ikke starte parring");
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
      disconnectSSE();
    }
  };

  const stopPairing = async () => {
    try {
      await fetch(`${PAIRING_SERVICE_URL}/pairing/stop`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to stop pairing:", err);
    }
    disconnectSSE();
    setStep("idle");
    setDeviceInfo(null);
    setNewName("");
  };

  const renameDevice = async () => {
    if (!newName.trim()) {
      toast.error("Indtast et navn");
      return;
    }

    if (!deviceInfo?.ieee_address) {
      toast.error("Ingen enhed at omdøbe");
      return;
    }

    try {
      const response = await fetch(`${PAIRING_SERVICE_URL}/pairing/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ieee_address: deviceInfo.ieee_address,
          new_name: newName.trim(),
          baseTopic: selectedArea,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Kunne ikke omdøbe");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const removeDevice = async () => {
    if (!deviceInfo?.ieee_address) return;

    try {
      await fetch(`${PAIRING_SERVICE_URL}/pairing/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ieee_address: deviceInfo.ieee_address,
          baseTopic: selectedArea,
          force: true,
        }),
      });
      toast.info("Enhed fjernet");
      stopPairing();
    } catch (err: any) {
      toast.error("Kunne ikke fjerne enhed");
    }
  };

  const resetForNextMeter = () => {
    setStep("idle");
    setDeviceInfo(null);
    setNewName("");
    setError(null);
    setTestResult(null);
  };

  // Render baseret på step
  const renderContent = () => {
    switch (step) {
      case "idle":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Radio className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Klar til parring</h2>
              <p className="text-muted-foreground">
                Vælg område og tryk på knappen for at starte parring
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="area">Vælg område</Label>
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger id="area" className="mt-1">
                    <SelectValue placeholder="Vælg område..." />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.baseTopic}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={startPairing}
                className="w-full h-16 text-lg"
                size="lg"
              >
                <Radio className="mr-2 h-6 w-6" />
                Start parring
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}
          </div>
        );

      case "waiting":
        return (
          <div className="space-y-6 text-center">
            <div className="relative">
              <Loader2 className="w-20 h-20 mx-auto text-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-background rounded-full" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Venter på enhed...</h2>
              <p className="text-muted-foreground">
                Parrer nu på ny måler:<br />
                Hold knappen inde i 5 sekunder
              </p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Område: {areas.find(a => a.baseTopic === selectedArea)?.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Parring timeout: 4 minutter
              </p>
            </div>
            <Button
              variant="outline"
              onClick={stopPairing}
              className="w-full"
            >
              Afbryd
            </Button>
          </div>
        );

      case "joined":
      case "interviewing":
        return (
          <div className="space-y-6 text-center">
            <div className="relative">
              <Loader2 className="w-20 h-20 mx-auto text-amber-500 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">
                {step === "joined" ? "Enhed fundet!" : "Interview i gang..."}
              </h2>
              <p className="text-muted-foreground">
                IEEE: <code className="text-xs bg-muted px-2 py-1 rounded">{deviceInfo?.ieee_address}</code>
              </p>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 mb-2" />
              <p className="text-sm font-medium text-amber-700">
                Vent venligst - afbryd ikke!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Enheden udveksler information med netværket
              </p>
            </div>
          </div>
        );

      case "ready":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Enhed klar!</h2>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IEEE:</span>
                <code className="text-xs">{deviceInfo?.ieee_address}</code>
              </div>
              {deviceInfo?.model && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Model:</span>
                  <span>{deviceInfo.model}</span>
                </div>
              )}
              {deviceInfo?.vendor && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Producent:</span>
                  <span>{deviceInfo.vendor}</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="name">Navngiv denne måler</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="F.eks. Plads 225"
                className="mt-1 text-lg h-12"
                autoFocus
              />
            </div>

            <Button
              onClick={renameDevice}
              className="w-full h-14 text-lg"
              disabled={!newName.trim()}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Gem og afslut
            </Button>
          </div>
        );

      case "testing":
        return (
          <div className="space-y-6 text-center">
            <div className="relative">
              <Loader2 className="w-20 h-20 mx-auto text-blue-500 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Tester måler...</h2>
              <p className="text-muted-foreground">
                Relæ test: OFF → vent 3 sek → ON
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Se efter at lyset blinker på måleren
              </p>
            </div>
            {testResult !== null && (
              <div className={`p-4 rounded-lg ${testResult ? 'bg-green-500/10 border border-green-500/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                {testResult ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Måler testet: OK</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-destructive">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Måler test fejlet</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case "failed":
        return (
          <div className="space-y-6 text-center">
            <XCircle className="w-20 h-20 mx-auto text-destructive" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Interview fejlet</h2>
              <p className="text-muted-foreground">
                Enheden kunne ikke konfigureres korrekt.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                IEEE: <code className="text-xs bg-muted px-2 py-1 rounded">{deviceInfo?.ieee_address}</code>
              </p>
            </div>
            <div className="space-y-3">
              <Button
                variant="destructive"
                onClick={removeDevice}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Fjern enhed fra netværk
              </Button>
              <Button
                variant="outline"
                onClick={resetForNextMeter}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Prøv igen
              </Button>
            </div>
          </div>
        );

      case "success":
        return (
          <div className="space-y-6 text-center">
            <CheckCircle2 className="w-20 h-20 mx-auto text-green-500" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Måler oprettet!</h2>
              <p className="text-muted-foreground">
                "{newName}" er nu klar til brug
              </p>
            </div>
            <div className="space-y-3">
              <Button
                onClick={resetForNextMeter}
                className="w-full h-14 text-lg"
              >
                <Radio className="mr-2 h-5 w-5" />
                Par næste måler
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/maalere")}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tilbage til oversigt
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-2xl font-bold">Parring</h1>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? "Forbundet" : "Afbrudt"}
                </span>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-center text-lg">
                  {step === "idle" && "Start parring"}
                  {step === "waiting" && "Parring aktiv"}
                  {(step === "joined" || step === "interviewing") && "Enhed fundet"}
                  {step === "ready" && "Navngiv måler"}
                  {step === "testing" && "Tester måler"}
                  {step === "failed" && "Fejl"}
                  {step === "success" && "Færdig"}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderContent()}</CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Parring;
