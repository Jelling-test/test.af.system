import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Power, Search, Shield, Wifi, WifiOff, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface FreeMeter {
  meter_number: string;
  is_online: boolean;
  admin_bypass: boolean;
  current_state?: string;
  last_power?: number;
}

interface ManuelTaendProps {
  isStaff?: boolean;
}

const ManuelTaend = ({ isStaff = false }: ManuelTaendProps) => {
  const [meters, setMeters] = useState<FreeMeter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeter, setSelectedMeter] = useState<FreeMeter | null>(null);
  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchFreeMeters();
  }, []);

  const fetchFreeMeters = async () => {
    setLoading(true);
    try {
      // Hent KUN målere med admin_bypass (aktivt tændte)
      const { data: bypassMeters, error: metersError } = await (supabase as any)
        .from("power_meters")
        .select("meter_number, is_online, admin_bypass")
        .eq("admin_bypass", true)
        .is("current_customer_id", null)
        .order("meter_number");

      if (metersError) throw metersError;

      const metersWithState: FreeMeter[] = (bypassMeters || []).map((m: any) => ({
        meter_number: m.meter_number,
        is_online: m.is_online ?? false,
        admin_bypass: true,
        current_state: "ON",
        last_power: 0,
      }));

      setMeters(metersWithState);
    } catch (error) {
      console.error("Error fetching bypass meters:", error);
      toast.error("Kunne ikke hente målere");
    } finally {
      setLoading(false);
    }
  };

  // Søg efter ledige målere i databasen
  const searchMeters = async (query: string) => {
    if (!query || query.length < 1) {
      setShowDropdown(false);
      return;
    }
    
    try {
      const { data, error } = await (supabase as any)
        .from("power_meters")
        .select("meter_number, is_online, admin_bypass")
        .is("current_customer_id", null)
        .ilike("meter_number", `%${query}%`)
        .limit(10);

      if (error) throw error;

      const results: FreeMeter[] = (data || []).map((m: any) => ({
        meter_number: m.meter_number,
        is_online: m.is_online ?? false,
        admin_bypass: m.admin_bypass ?? false,
        current_state: m.admin_bypass ? "ON" : "OFF",
        last_power: 0,
      }));

      // Opdater meters med søgeresultater (behold bypass meters)
      const bypassOnly = meters.filter(m => m.admin_bypass);
      setMeters([...bypassOnly, ...results.filter(r => !r.admin_bypass)]);
      setShowDropdown(true);
    } catch (error) {
      console.error("Error searching meters:", error);
    }
  };

  const handleTurnOn = (meter: FreeMeter) => {
    setSelectedMeter(meter);
    setReason("");
    setDialogOpen(true);
  };

  const confirmTurnOn = async () => {
    if (!selectedMeter) return;

    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Du skal være logget ind");
        return;
      }

      // 1. Aktiver admin bypass
      const bypassResponse = await supabase.functions.invoke("admin-bypass-meter", {
        body: {
          meter_id: selectedMeter.meter_number,
          action: "enable",
          reason: reason || "Manuel tænding uden pakke",
        },
      });

      if (bypassResponse.error) throw bypassResponse.error;

      // 2. Send tænd kommando
      const { error: commandError } = await (supabase as any)
        .from("meter_commands")
        .insert({
          meter_id: selectedMeter.meter_number,
          command: "set_state",
          value: "ON",
          status: "pending",
        });

      if (commandError) throw commandError;

      toast.success(`${selectedMeter.meter_number} tændes med admin bypass`);
      setDialogOpen(false);
      
      // Opdater listen efter kort delay
      setTimeout(fetchFreeMeters, 1000);
    } catch (error) {
      console.error("Error turning on meter:", error);
      toast.error("Kunne ikke tænde måler");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTurnOff = async (meter: FreeMeter) => {
    try {
      // 1. Deaktiver admin bypass
      await supabase.functions.invoke("admin-bypass-meter", {
        body: {
          meter_id: meter.meter_number,
          action: "disable",
          reason: "Manuel slukning",
        },
      });

      // 2. Send sluk kommando
      await (supabase as any).from("meter_commands").insert({
        meter_id: meter.meter_number,
        command: "set_state",
        value: "OFF",
        status: "pending",
      });

      toast.success(`${meter.meter_number} slukkes`);
      setTimeout(fetchFreeMeters, 1000);
    } catch (error) {
      console.error("Error turning off meter:", error);
      toast.error("Kunne ikke slukke måler");
    }
  };

  const filteredMeters = meters.filter((m) =>
    m.meter_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Opdel i tændte (med bypass) og slukkede
  const activeMeters = filteredMeters.filter((m) => m.admin_bypass);
  const inactiveMeters = filteredMeters.filter((m) => !m.admin_bypass);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {isStaff ? <StaffSidebar /> : <AdminSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-background flex items-center px-6">
            <SidebarTrigger />
            <h1 className="text-2xl font-bold ml-4">Manuel Tænd (Uden Pakke)</h1>
          </header>

          <main className="flex-1 p-6 bg-muted/20">
            {/* Søgefelt med dropdown */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Søg efter ledig måler (eks: 210, 101,3...)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchMeters(e.target.value);
                  }}
                  onFocus={() => searchQuery.length > 0 && searchMeters(searchQuery)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  className="pl-10"
                />
                {/* Dropdown med søgeresultater */}
                {showDropdown && searchQuery.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
                    {filteredMeters.slice(0, 10).map((meter) => (
                      <div
                        key={meter.meter_number}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted cursor-pointer border-b last:border-0"
                        onClick={() => {
                          if (meter.admin_bypass) {
                            handleTurnOff(meter);
                          } else {
                            handleTurnOn(meter);
                          }
                          setShowDropdown(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{meter.meter_number}</span>
                          {meter.is_online ? (
                            <Badge variant="default" className="text-xs">
                              <Wifi className="h-3 w-3 mr-1" />
                              Online
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <WifiOff className="h-3 w-3 mr-1" />
                              Offline
                            </Badge>
                          )}
                          {meter.admin_bypass && (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                              <Shield className="h-3 w-3 mr-1" />
                              Bypass
                            </Badge>
                          )}
                        </div>
                        <Button size="sm" variant={meter.admin_bypass ? "destructive" : "default"} disabled={!meter.is_online && !meter.admin_bypass}>
                          <Power className="h-4 w-4 mr-1" />
                          {meter.admin_bypass ? "Sluk" : "Tænd"}
                        </Button>
                      </div>
                    ))}
                    {filteredMeters.length === 0 && (
                      <div className="px-4 py-3 text-muted-foreground text-center">
                        Ingen målere matcher "{searchQuery}"
                      </div>
                    )}
                    {filteredMeters.length > 10 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/50">
                        Viser 10 af {filteredMeters.length} resultater
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={fetchFreeMeters} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Opdater
              </Button>
            </div>

            {/* Info boks */}
            <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-400">
                      Denne side viser kun målere UDEN tilknyttet kunde
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                      Når du tænder en måler her, aktiveres automatisk Admin Bypass så den ikke slukkes af sikkerhedssystemet.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aktivt tændte (med bypass) */}
            {activeMeters.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <Power className="h-5 w-5" />
                    Aktivt Tændte ({activeMeters.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeMeters.map((meter) => (
                      <div
                        key={meter.meter_number}
                        className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{meter.meter_number}</span>
                          <div className="flex gap-1">
                            {meter.is_online ? (
                              <Badge variant="default" className="text-xs">
                                <Wifi className="h-3 w-3 mr-1" />
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Offline
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <Shield className="h-3 w-3 mr-1" />
                            Bypass aktiv
                          </Badge>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => handleTurnOff(meter)}
                        >
                          <Power className="h-4 w-4 mr-2" />
                          Sluk
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tip: Brug søgefeltet */}
            {activeMeters.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-4">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Brug søgefeltet ovenfor for at finde og tænde en ledig måler
                  </p>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>

      {/* Bekræft dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className="h-5 w-5 text-green-500" />
              Tænd {selectedMeter?.meter_number}
            </DialogTitle>
            <DialogDescription>
              Dette aktiverer Admin Bypass og tænder måleren. Den vil forblive tændt indtil du slukker den manuelt.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Grund (valgfrit)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="F.eks. Test, Reparation, Rengøring..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={confirmTurnOn} disabled={actionLoading}>
              {actionLoading ? "Tænder..." : "Tænd Måler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default ManuelTaend;
