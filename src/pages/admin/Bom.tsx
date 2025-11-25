import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, DoorOpen, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { ManualCustomersTable } from "@/components/admin/ManualCustomersTable";
import { BarrierStatistics } from "@/components/admin/BarrierStatistics";
import { CameraFeed } from "@/components/admin/CameraFeed";
import { useNavigate } from "react-router-dom";
import { formatDanishDateTime, formatDanishDate } from "@/utils/dateTime";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PlateDetection {
  id: string;
  created_at: string;
  plate_text: string;
  plate_country: string;
  car_direction: string;
  car_state: string;
  vehicle_type: string | null;
  vehicle_color: string | null;
  plate_confidence: string;
  customer_name?: string;
  booking_id?: number;
  category?: string;
  departure_date?: string;
}

interface ControlRequest {
  id: string;
  requested_at: string;
  action: string;
  status: string;
  camera_serial: string;
  executed_at: string | null;
  error: string | null;
}

const AdminBom = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<PlateDetection[]>([]);
  const [controlRequests, setControlRequests] = useState<ControlRequest[]>([]);
  const [searchPlate, setSearchPlate] = useState("");
  const [filteredLogs, setFilteredLogs] = useState<PlateDetection[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkUserRole();
    fetchLogs();
    fetchControlRequests();

    const logsChannel = supabase
      .channel('plate-detections-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'plate_detections' },
        async (payload) => {
          console.log('New plate detection:', payload.new);
          // Hent approved plate info for den nye detektion
          const plateText = (payload.new as any).plate_text;
          const { data: approvedData } = await (supabase as any)
            .from('approved_plates')
            .select('plate_text, customer_name, booking_id, source, notes, departure_date')
            .eq('plate_text', plateText)
            .single();
          
          // Fjern " - Personale" eller " - Sæson" fra navnet hvis det findes
          let customerName = approvedData?.customer_name || approvedData?.notes || null;
          if (customerName) {
            customerName = customerName.replace(/\s*-\s*(Personale|Sæson)\s*$/i, '');
          }
          
          const enriched = {
            ...payload.new,
            customer_name: customerName,
            booking_id: approvedData?.booking_id,
            category: approvedData?.source === 'sirvoy_webhook' ? 'Sæson' : approvedData?.source === 'manual' ? 'Personale' : null,
            departure_date: approvedData?.departure_date || null
          };
          
          // Tjek for duplikat før tilføjelse
          setLogs((prev) => {
            const newLog = enriched as PlateDetection;
            const newTime = formatDanishDateTime(newLog.created_at, {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            const isDuplicate = prev.some(log => 
              log.plate_text === newLog.plate_text && 
              formatDanishDateTime(log.created_at, {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }) === newTime
            );
            
            if (isDuplicate) {
              return prev; // Tilføj ikke duplikat
            }
            
            return [newLog, ...prev].slice(0, 15);
          });
        }
      )
      .subscribe();

    const controlChannel = supabase
      .channel('control-requests-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'access', table: 'control_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setControlRequests((prev) => [payload.new as ControlRequest, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setControlRequests((prev) => 
              prev.map(req => req.id === payload.new.id ? payload.new as ControlRequest : req)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(controlChannel);
    };
  }, []);

  useEffect(() => {
    if (searchPlate.trim()) {
      const normalized = searchPlate.toUpperCase().replace(/[\s\.\-]/g, '');
      const filtered = logs.filter(log => 
        log.plate_text.includes(normalized)
      );
      setFilteredLogs(filtered);
    } else {
      setFilteredLogs(logs);
    }
  }, [searchPlate, logs]);

  const checkUserRole = async () => {
    // Check which route we're on to determine correct dashboard
    const isStaffRoute = window.location.pathname.startsWith('/staff');
    setUserRole(isStaffRoute ? 'staff' : 'admin');
  };

  const fetchLogs = async () => {
    // Hent plate detections
    const { data: detections, error } = await (supabase as any)
      .from('plate_detections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Error fetching logs:', error);
      return;
    }

    // Hent approved plates info
    const plates = detections?.map((d: any) => d.plate_text) || [];
    const { data: approvedData } = await (supabase as any)
      .from('approved_plates')
      .select('plate_text, customer_name, booking_id, source, notes, departure_date')
      .in('plate_text', plates);

    // Join data
    const enriched = detections?.map((detection: any) => {
      const approved = approvedData?.find((a: any) => a.plate_text === detection.plate_text);
      
      // Fjern " - Personale" eller " - Sæson" fra navnet hvis det findes
      let customerName = approved?.customer_name || approved?.notes || null;
      if (customerName) {
        customerName = customerName.replace(/\s*-\s*(Personale|Sæson)\s*$/i, '');
      }
      
      return {
        ...detection,
        customer_name: customerName,
        booking_id: approved?.booking_id,
        category: approved?.source === 'sirvoy_webhook' ? 'Sæson' : approved?.source === 'manual' ? 'Personale' : null,
        departure_date: approved?.departure_date || null
      };
    }) || [];

    // Filtrer duplikater - samme plade + samme minut
    const uniqueLogs = enriched.reduce((acc: PlateDetection[], current: PlateDetection) => {
      const currentMinute = formatDanishDateTime(current.created_at, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const isDuplicate = acc.some(log => 
        log.plate_text === current.plate_text && 
        formatDanishDateTime(log.created_at, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) === currentMinute
      );
      
      if (!isDuplicate) {
        acc.push(current);
      }
      
      return acc;
    }, []);

    setLogs(uniqueLogs);
  };

  const fetchControlRequests = async () => {
    const { data, error } = await (supabase as any)
      .schema('access')
      .from('control_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching control requests:', error);
    } else if (data) {
      setControlRequests(data as any);
    }
  };

  const handleOpenBarrier = async () => {
    setIsOpening(true);
    try {
      const cameraSerial = import.meta.env.VITE_CAMERA_SERIAL || "CAMERA001";
      
      console.log('Opening barrier via Edge Function with camera:', cameraSerial);
      
      // Hent brugerens session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Ikke logget ind');
      }

      // Kald gate-open Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gate-open`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source: 'admin_ui',
            camera_serial: cameraSerial
          })
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Edge Function error:', result);
        throw new Error(result.error || 'Fejl ved åbning af bom');
      }
      
      console.log('Gate opened successfully:', result);
      toast.success('Bommen åbnes nu');
    } catch (error: any) {
      console.error('Error opening barrier:', error);
      toast.error(`Kunne ikke åbne bommen: ${error.message || 'Ukendt fejl'}`);
    } finally {
      setIsOpening(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: da });
    } catch {
      return timestamp;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      executed: "default",
      failed: "destructive",
      expired: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {userRole === 'staff' ? <StaffSidebar /> : <AdminSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-3 flex-1">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Bomstyring</h1>
                <p className="text-sm text-muted-foreground">Administration af adgangskontrol</p>
              </div>
            </div>
            <Button 
              onClick={handleOpenBarrier} 
              disabled={isOpening}
              size="lg"
              className="gap-2"
            >
              <DoorOpen className="h-5 w-5" />
              {isOpening ? 'Åbner...' : 'Åbn bom nu'}
            </Button>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 space-y-4 sm:space-y-6 overflow-auto">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Statistik</TabsTrigger>
                <TabsTrigger value="customers">Manuelle kunder</TabsTrigger>
                <TabsTrigger value="logs">Adgangslog</TabsTrigger>
                <TabsTrigger value="control">Kontrolanmodninger</TabsTrigger>
              </TabsList>

        <TabsContent value="overview">
          <BarrierStatistics />
        </TabsContent>

        <TabsContent value="customers">
          <ManualCustomersTable />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            {/* Kamera feed - 3/5 af siden */}
            <div className="lg:col-span-3">
              <CameraFeed cameraSerial={import.meta.env.VITE_CAMERA_SERIAL || "CAMERA001"} title="Live Kamera Feed" />
            </div>

            {/* Live adgangslog - 2/5 af siden */}
            <div className="lg:col-span-2">
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>Live adgangslog</CardTitle>
                  <CardDescription>Seneste 15 adgangsforsøg</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="text-[10px] px-2 py-1">Tidspunkt</TableHead>
                          <TableHead className="text-[10px] px-2 py-1">Plade</TableHead>
                          <TableHead className="text-[10px] px-2 py-1">Navn</TableHead>
                          <TableHead className="text-[10px] px-2 py-1">Kat.</TableHead>
                          <TableHead className="text-[10px] px-2 py-1">Booking</TableHead>
                          <TableHead className="text-[10px] px-2 py-1">Udtjek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                              Ingen logs endnu
                            </TableCell>
                          </TableRow>
                        ) : (
                          logs.map((log) => {
                            // Tjek om udtjek dato er overskredet eller i dag
                            const isExpired = log.departure_date ? new Date(log.departure_date) <= new Date(new Date().toDateString()) : false;
                            const rowClass = !log.customer_name 
                              ? 'text-red-600 dark:text-red-400' 
                              : isExpired 
                                ? 'bg-yellow-100 dark:bg-yellow-900/30' 
                                : '';
                            
                            return (
                            <TableRow key={log.id} className={`text-[10px] ${rowClass}`}>
                              <TableCell className="whitespace-nowrap px-2 py-1">
                                {formatDanishDateTime(log.created_at, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell className="font-mono font-bold px-2 py-1">
                                {log.plate_text}
                              </TableCell>
                              <TableCell className="px-2 py-1 max-w-[120px] truncate" title={log.customer_name || '-'}>
                                {log.customer_name || '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1">
                                {log.category && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">{log.category}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="px-2 py-1">
                                {log.booking_id || '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1 whitespace-nowrap">
                                {log.departure_date ? formatDanishDate(log.departure_date) : '-'}
                              </TableCell>
                            </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="control">
          <Card>
            <CardHeader>
              <CardTitle>Kontrolanmodninger</CardTitle>
              <CardDescription>Status på manuelle og automatiske bomåbninger</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {controlRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Ingen kontrolanmodninger</p>
                ) : (
                  controlRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{req.action.toUpperCase()}</span>
                          {getStatusBadge(req.status)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Anmodet: {formatTime(req.requested_at)}
                          {req.executed_at && ` • Udført: ${formatTime(req.executed_at)}`}
                        </div>
                        {req.error && (
                          <div className="text-sm text-destructive mt-1">Fejl: {req.error}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminBom;
