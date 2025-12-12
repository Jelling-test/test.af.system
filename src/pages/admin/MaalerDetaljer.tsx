import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Power, RefreshCw, Shield } from "lucide-react";
import { AdminBypassButton } from "@/components/admin/AdminBypassButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface MeterReading {
  time: string;
  power: number;
  current: number;
  voltage: number;
  energy: number;
  state: string | null;
  linkquality: number;
}

interface Customer {
  id: string;
  booking_id: number;
  first_name: string;
  last_name: string;
  arrival_date: string;
  departure_date: string;
  checked_in: boolean;
  checked_out: boolean;
  spot_number: string | null;
  meter_start_energy?: number;
  meter_start_time?: string;
  type: 'seasonal' | 'regular';
  has_power_package?: boolean;
  power_package_type?: string;
  power_included_kwh?: number;
}

interface Package {
  id: string;
  data: {
    pakke_navn: string;
    enheder: number;
    status: string;
    betaling_metode: string;
    pakke_start_energy?: number;
  };
  created_at: string;
}

interface MaalerDetaljerProps {
  isStaffView?: boolean;
}

const MaalerDetaljer = ({ isStaffView = false }: MaalerDetaljerProps = {}) => {
  const { meterId } = useParams<{ meterId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentReading, setCurrentReading] = useState<MeterReading | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [history, setHistory] = useState<MeterReading[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [adminBypass, setAdminBypass] = useState(false);

  useEffect(() => {
    if (meterId) {
      fetchMeterData();
      
      // Auto-refresh every 3 seconds
      const interval = setInterval(() => {
        fetchMeterData();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [meterId]);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchHistory();
    }
  }, [fromDate, toDate]);

  const fetchMeterData = async () => {
    try {
      // Get meter online status and admin_bypass from power_meters
      const { data: meterData } = await (supabase as any)
        .from("power_meters")
        .select("is_online, admin_bypass")
        .eq("meter_number", meterId)
        .maybeSingle();

      setIsOnline(meterData?.is_online ?? true);
      setAdminBypass(meterData?.admin_bypass ?? false);

      // Get latest reading
      const { data, error } = await (supabase as any)
        .from("meter_readings")
        .select("*")
        .eq("meter_id", meterId)
        .order("time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setCurrentReading(data);

      // Get customer assigned to this meter
      await fetchCustomerData();
    } catch (error) {
      console.error("Error fetching meter data:", error);
      toast.error("Fejl ved hentning af måler data");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerData = async () => {
    try {
      // Check seasonal customers (meter_id now stores meter_number)
      const { data: seasonalData } = await (supabase as any)
        .from("seasonal_customers")
        .select("*")
        .eq("meter_id", meterId)
        .eq("checked_in", true)
        .maybeSingle();

      if (seasonalData) {
        setCustomer({ ...seasonalData, type: 'seasonal' });
        await fetchPackages(seasonalData.booking_id);
        return;
      }

      // Check regular customers (uses meter_number)
      const { data: regularData } = await (supabase as any)
        .from("regular_customers")
        .select("*")
        .eq("meter_id", meterId)
        .eq("checked_in", true)
        .maybeSingle();

      if (regularData) {
        setCustomer({ ...regularData, type: 'regular' });
        await fetchPackages(regularData.booking_id);
      } else {
        setCustomer(null);
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

  const fetchPackages = async (bookingId: number) => {
    try {
      const { data, error } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakker")
        .eq("data->>booking_nummer", bookingId.toString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error("Error fetching packages:", error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("meter_readings")
        .select("*")
        .eq("meter_id", meterId)
        .gte("time", fromDate)
        .lte("time", toDate + "T23:59:59")
        .order("time", { ascending: false })
        .limit(10000);

      if (error) throw error;

      // Aggregate to 1 reading per minute
      const aggregated = aggregateByMinute(data || []);
      setHistory(aggregated);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Fejl ved hentning af historik");
    }
  };

  const aggregateByMinute = (readings: MeterReading[]) => {
    const minuteMap = new Map<string, MeterReading[]>();
    
    // Group by minute
    readings.forEach(reading => {
      const date = new Date(reading.time);
      const minuteKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      if (!minuteMap.has(minuteKey)) {
        minuteMap.set(minuteKey, []);
      }
      minuteMap.get(minuteKey)!.push(reading);
    });
    
    // Take last reading from each minute
    const result: MeterReading[] = [];
    minuteMap.forEach((readings) => {
      result.push(readings[0]); // First one since we ordered by descending
    });
    
    return result.reverse(); // Reverse to get ascending order for chart
  };

  const handleTogglePower = async () => {
    if (!currentReading) return;

    try {
      const newState = currentReading.state === "ON" ? "OFF" : "ON";
      
      // Insert command into meter_commands table
      const { error } = await (supabase as any)
        .from("meter_commands")
        .insert({
          meter_id: meterId,
          command: "set_state",
          value: newState,
          status: "pending"
        });

      if (error) throw error;

      toast.success(`Kommando sendt til ${meterId} - opdaterer automatisk...`);
    } catch (error) {
      console.error("Error toggling power:", error);
      toast.error("Fejl ved strøm toggle");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Indlæser...</p>
      </div>
    );
  }

  if (!currentReading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Ingen data fundet for denne måler</p>
      </div>
    );
  }

  // isOnline is now from state (Z2M availability)
  const secondsAgo = Math.floor((Date.now() - new Date(currentReading.time).getTime()) / 1000);
  const lastSeenText = secondsAgo < 60 ? `${secondsAgo}s siden` : 
                       secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)}m siden` :
                       `${Math.floor(secondsAgo / 3600)}t siden`;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full animate-fade-in">
        {isStaffView ? <StaffSidebar /> : <AdminSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="h-14 sm:h-16 border-b bg-background flex items-center px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <Button
              variant="ghost"
              onClick={() => navigate(`${isStaffView ? '/staff' : '/admin'}/maalere`)}
              className="ml-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbage
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold ml-4">{meterId}</h1>
          </header>
          
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 overflow-auto">
            {/* Current Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Badge variant={isOnline ? "default" : "destructive"}>
                      {isOnline ? "Online" : "Offline"}
                    </Badge>
                    {currentReading.state && (
                      <Badge variant={currentReading.state === "ON" ? "default" : "secondary"}>
                        {currentReading.state}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Sidst set: {lastSeenText}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Effekt</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentReading.power?.toFixed(1) ?? '0.0'} W</div>
                  <p className="text-xs text-muted-foreground">
                    {currentReading.current?.toFixed(2) ?? '0.00'} A
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Spænding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentReading.voltage?.toFixed(0) ?? '0'} V</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Energi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {currentReading.energy !== null && currentReading.energy !== undefined
                      ? currentReading.energy.toFixed(2)
                      : '0.00'} kWh
                  </div>
                  <Badge variant={currentReading.linkquality > 80 ? "default" : "destructive"} className="mt-2">
                    Signal: {currentReading.linkquality}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Customer Info */}
            {customer && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Kunde Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Navn</p>
                      <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Booking</p>
                      <p className="font-medium">#{customer.booking_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Plads</p>
                      <p className="font-medium">{customer.spot_number || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <Badge>{customer.type === 'seasonal' ? 'Sæson' : 'Kørende'}</Badge>
                    </div>
                    {customer.meter_start_energy !== null && customer.meter_start_energy !== undefined && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Start Aflæsning</p>
                          <p className="font-medium">{customer.meter_start_energy.toFixed(2)} kWh</p>
                          {customer.meter_start_time && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(customer.meter_start_time).toLocaleString('da-DK')}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Nuværende Forbrug</p>
                          <p className="font-medium text-primary">
                            {currentReading.energy && customer.meter_start_energy
                              ? (currentReading.energy - customer.meter_start_energy).toFixed(2)
                              : '0.00'} kWh
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Package Info */}
                  {packages.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h3 className="font-semibold mb-4">Pakker</h3>
                      {(() => {
                        // Beregn total forbrug og total pakker
                        const activePakker = packages.filter((p: any) => p.data.status === 'aktiv');
                        
                        // Beregn total forbrug baseret på den ÆLDSTE aktive pakkes start
                        // Option D: Brug pakke_start_energy KUN hvis > 0, ellers meter_start_energy
                        const oldestActivePakke = activePakker.reduce((oldest: any, p: any) => {
                          const pStartRaw = p.data.pakke_start_energy;
                          const pStart = (pStartRaw !== null && pStartRaw !== undefined && pStartRaw > 0)
                            ? pStartRaw
                            : parseFloat(customer.meter_start_energy || '0');
                          const oldestStartRaw = oldest.data?.pakke_start_energy;
                          const oldestStart = (oldestStartRaw !== null && oldestStartRaw !== undefined && oldestStartRaw > 0)
                            ? oldestStartRaw
                            : parseFloat(customer.meter_start_energy || '0');
                          return pStart < oldestStart ? p : oldest;
                        }, activePakker[0] || {});
                        
                        const totalStartRaw = oldestActivePakke.data?.pakke_start_energy;
                        const totalStartEnergy = (totalStartRaw !== null && totalStartRaw !== undefined && totalStartRaw > 0)
                          ? totalStartRaw
                          : parseFloat(customer.meter_start_energy || '0');
                        
                        // KRITISK: Inkluder accumulated_usage fra alle pakker (forbrug fra tidligere målere)
                        const totalAccumulated = activePakker.reduce((sum: number, p: any) => 
                          sum + parseFloat(p.data.accumulated_usage || '0'), 0);
                        const totalUsage = totalAccumulated + (currentReading.energy - totalStartEnergy);
                        const totalEnheder = activePakker.reduce((sum: number, p: any) => sum + parseFloat(p.data.enheder), 0);
                        const totalRemaining = totalEnheder - totalUsage;
                        const totalPercentUsed = totalEnheder > 0 ? (totalUsage / totalEnheder) * 100 : 0;
                        
                        return (
                          <>
                            {/* Total oversigt */}
                            {activePakker.length > 0 && (
                              <div className="bg-primary/10 rounded-lg p-4 mb-4 border-2 border-primary">
                                <h4 className="font-semibold mb-3">Total Oversigt</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span>Total Forbrug:</span>
                                    <span className="font-medium">{totalUsage.toFixed(2)} / {totalEnheder.toFixed(2)} kWh</span>
                                  </div>
                                  <div className="w-full bg-secondary rounded-full h-3">
                                    <div 
                                      className={`h-3 rounded-full transition-all ${
                                        totalPercentUsed >= 90 ? 'bg-destructive' : 
                                        totalPercentUsed >= 70 ? 'bg-yellow-500' : 
                                        'bg-primary'
                                      }`}
                                      style={{ width: `${Math.min(totalPercentUsed, 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tilbage:</span>
                                    <span className={`font-medium ${totalRemaining <= 0 ? 'text-destructive' : ''}`}>
                                      {Math.max(totalRemaining, 0).toFixed(2)} kWh
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Individuelle pakker - fordel forbrug i rækkefølge */}
                            {(() => {
                              // Sorter pakker: sæson/reception først, derefter tillæg/stripe
                              const sortedPakker = [...packages].sort((a: any, b: any) => {
                                const aIsTillaeg = a.data.betaling_metode === 'stripe' || a.data.pakke_navn?.includes('tillæg');
                                const bIsTillaeg = b.data.betaling_metode === 'stripe' || b.data.pakke_navn?.includes('tillæg');
                                if (aIsTillaeg && !bIsTillaeg) return 1;
                                if (!aIsTillaeg && bIsTillaeg) return -1;
                                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                              });
                              
                              let remainingUsage = totalUsage;
                              
                              return sortedPakker.map((pkg: any) => {
                                const enheder = parseFloat(String(pkg.data.enheder));
                                const pkgUsage = pkg.data.status === 'aktiv' 
                                  ? Math.max(0, Math.min(remainingUsage, enheder))
                                  : 0;
                                if (pkg.data.status === 'aktiv') {
                                  remainingUsage = Math.max(0, remainingUsage - enheder);
                                }
                                const pkgRemaining = enheder - pkgUsage;
                                const percentUsed = (pkgUsage / enheder) * 100;

                                return (
                                  <div key={pkg.id} className="bg-muted/50 rounded-lg p-4 mb-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium">{pkg.data.pakke_navn}</p>
                                          <Badge variant={pkg.data.status === 'aktiv' ? 'default' : 'secondary'}>
                                            {pkg.data.status}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Tildelt: {new Date(pkg.created_at).toLocaleString('da-DK')}
                                        </p>
                                      </div>
                                      <Badge variant={pkg.data.betaling_metode === 'gratis' ? 'secondary' : 'outline'}>
                                        {pkg.data.betaling_metode}
                                      </Badge>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span>Forbrug:</span>
                                        <span className="font-medium">{pkgUsage.toFixed(2)} / {pkg.data.enheder} kWh</span>
                                      </div>
                                      <div className="w-full bg-secondary rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all ${
                                            percentUsed >= 90 ? 'bg-destructive' : 
                                            percentUsed >= 70 ? 'bg-yellow-500' : 
                                            'bg-primary'
                                          }`}
                                          style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Tilbage:</span>
                                        <span className={`font-medium ${pkgRemaining <= 0 ? 'text-destructive' : ''}`}>
                                          {Math.max(pkgRemaining, 0).toFixed(2)} kWh
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Handlinger</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button onClick={handleTogglePower}>
                    <Power className="mr-2 h-4 w-4" />
                    {currentReading.state === "ON" ? "Sluk" : "Tænd"}
                  </Button>
                  <Button variant="outline" onClick={fetchMeterData}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Opdater
                  </Button>
                  <AdminBypassButton 
                    meterId={meterId || ''} 
                    hasBypass={adminBypass} 
                    onUpdate={fetchMeterData}
                  />
                </div>
                {adminBypass && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Shield className="h-4 w-4" />
                      <span className="font-medium">Admin Bypass er aktiv</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Denne måler kan være tændt uden kunde eller pakke.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardHeader>
                <CardTitle>Historik</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="from-date">Fra dato</Label>
                    <Input
                      id="from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="to-date">Til dato</Label>
                    <Input
                      id="to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>

                {history.length > 0 ? (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-background">
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart 
                          data={history.map(r => ({
                            time: new Date(r.time).toLocaleString("da-DK", { 
                              month: "short", 
                              day: "numeric", 
                              hour: "2-digit", 
                              minute: "2-digit" 
                            }),
                            energy: r.energy,
                            fullTime: new Date(r.time).toLocaleString("da-DK")
                          }))}
                          margin={{ top: 5, right: 20, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                            tick={{ fontSize: 12 }}
                            domain={['dataMin', 'dataMax']}
                            scale="linear"
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border rounded-lg p-3 shadow-lg">
                                    <p className="text-sm font-medium">{payload[0].payload.fullTime}</p>
                                    <p className="text-lg font-bold text-primary">
                                      {Number(payload[0].value).toFixed(2)} kWh
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="energy" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="p-2 bg-muted text-sm text-center rounded-lg">
                      Viser {history.length} målinger fra {new Date(history[history.length - 1].time).toLocaleDateString("da-DK")} til {new Date(history[0].time).toLocaleDateString("da-DK")}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Vælg datoer for at se energi historik
                  </p>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MaalerDetaljer;
