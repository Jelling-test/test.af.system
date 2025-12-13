import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreVertical,
  Power,
  Edit,
  Trash2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  X,
  Settings,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface Meter {
  meter_id: string;
  last_seen: string;
  power: number;
  current: number;
  voltage: number;
  energy: number;
  state: string | null;
  linkquality: number;
  is_available: boolean;
  is_online: boolean;
}

interface AdminMaalereProps {
  isStaffView?: boolean;
}

const AdminMaalere = ({ isStaffView = false }: AdminMaalereProps = {}) => {
  const navigate = useNavigate();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [filteredMeters, setFilteredMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMeters, setSelectedMeters] = useState<string[]>([]);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  
  // Form states
  const [newMeterName, setNewMeterName] = useState("");
  const [newMeterEntity, setNewMeterEntity] = useState("");
  const [renameMeter, setRenameMeter] = useState<Meter | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [deleteMeter, setDeleteMeter] = useState<Meter | null>(null);
  const [sendEmailStats, setSendEmailStats] = useState(false);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [discoveredMeters, setDiscoveredMeters] = useState<string[]>([]);
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchMeters();
    
    // Auto-refresh every 10 seconds (optimeret for performance)
    const interval = setInterval(() => {
      fetchMeters();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterMeters();
  }, [meters, searchTerm, statusFilter, sortColumn, sortDirection]);

  const fetchMeters = async () => {
    try {
      // Kør alle queries parallelt for hurtigere load
      const [
        { data: powerMeters, error: metersError },
        { data: latestReadings },
        { data: regularCustomers },
        { data: seasonalCustomers },
        { data: extraMeters }
      ] = await Promise.all([
        (supabase as any).from("power_meters").select("*").order("meter_number", { ascending: true }),
        (supabase as any).from("latest_meter_readings").select("meter_id, time, power, current, voltage, energy, state, linkquality"),
        (supabase as any).from("regular_customers").select("meter_id").not("meter_id", "is", null),
        (supabase as any).from("seasonal_customers").select("meter_id").not("meter_id", "is", null),
        (supabase as any).from("booking_extra_meters").select("meter_id")
      ]);

      if (metersError) throw metersError;

      // Create map of latest reading per meter
      const latestReadingMap = new Map();
      latestReadings?.forEach((reading: any) => {
        latestReadingMap.set(reading.meter_id, reading);
      });

      // Create set of assigned meter IDs (inkluderer både primære og ekstra målere)
      const assignedMeterIds = new Set();
      regularCustomers?.forEach((c: any) => assignedMeterIds.add(c.meter_id));
      seasonalCustomers?.forEach((c: any) => assignedMeterIds.add(c.meter_id));
      extraMeters?.forEach((m: any) => assignedMeterIds.add(m.meter_id));

      // Combine meters with their readings
      const metersWithReadings: Meter[] = (powerMeters || []).map((meter: any) => {
        const reading = latestReadingMap.get(meter.meter_number);
        const isAssigned = assignedMeterIds.has(meter.meter_number);
        
        return {
          meter_id: meter.meter_number,
          last_seen: reading?.time || null,
          power: reading?.power || 0,
          current: reading?.current || 0,
          voltage: reading?.voltage || 0,
          energy: reading?.energy || 0,
          state: reading?.state || null,
          linkquality: reading?.linkquality || 0,
          is_available: !isAssigned, // Ledig hvis IKKE tildelt
          is_online: meter.is_online ?? true, // Fra Z2M availability
        };
      });

      setMeters(metersWithReadings);
    } catch (error) {
      console.error("Error fetching meters:", error);
      toast.error("Fejl ved hentning af målere");
    } finally {
      setLoading(false);
    }
  };

  const filterMeters = () => {
    let filtered = meters;

    // Status filter (online/offline based on is_online from Z2M)
    if (statusFilter !== "all") {
      filtered = filtered.filter((m) => {
        if (statusFilter === "online") return m.is_online;
        if (statusFilter === "offline") return !m.is_online;
        if (statusFilter === "on") return m.state === "ON";
        if (statusFilter === "off") return m.state === "OFF";
        if (statusFilter === "occupied") return !m.is_available;
        if (statusFilter === "available") return m.is_available;
        return true;
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((m) =>
        m.meter_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort if a column is selected
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortColumn as keyof Meter];
        let bVal: any = b[sortColumn as keyof Meter];
        
        // Handle null/undefined
        if (aVal == null) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
        if (bVal == null) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
        
        // Numeric comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    setFilteredMeters(filtered);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction or clear sort
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="ml-1 h-3 w-3" />
      : <ArrowUp className="ml-1 h-3 w-3" />;
  };

  const checkNameAvailability = async (name: string) => {
    if (!name.trim()) {
      setNameAvailable(null);
      return;
    }

    const exists = meters.some(
      (m) => m.meter_id?.toLowerCase() === name.toLowerCase() &&
      m.meter_id !== renameMeter?.meter_id
    );

    setNameAvailable(!exists);
  };

  const handleAddMeter = async () => {
    toast.info("Målere tilføjes automatisk fra MQTT data");
    setShowAddModal(false);
  };

  const handleRenameMeter = async () => {
    toast.info("Måler navne kommer fra MQTT topics");
    setShowRenameModal(false);
  };

  const handleDeleteMeter = async () => {
    if (!deleteMeter) return;

    try {
      console.log("Sletter måler via Edge Function:", deleteMeter.meter_id);
      
      // Call Edge Function to delete meter (uses service_role to bypass RLS)
      const { data, error } = await supabase.functions.invoke("delete-meter", {
        body: { 
          meter_id: deleteMeter.meter_id
        },
      });

      console.log("Edge Function response:", data, "Error:", error);

      if (error) {
        console.error("Edge Function fejlede:", error);
        throw error;
      }

      if (data?.error) {
        console.error("Edge Function returnerede fejl:", data.error);
        throw new Error(data.error);
      }

      toast.success(`Måler "${deleteMeter.meter_id}" slettet permanent`);
      setShowDeleteModal(false);
      setDeleteMeter(null);
      
      console.log("Henter målere igen...");
      await fetchMeters();
    } catch (error) {
      console.error("Error deleting meter:", error);
      toast.error("Fejl ved sletning af måler");
    }
  };


  const handleTogglePower = async (meter: Meter) => {
    try {
      const newState = meter.state === "ON" ? "OFF" : "ON";
      
      // Direkte insert i meter_commands (command-processor håndterer MQTT)
      const { error } = await supabase
        .from("meter_commands")
        .insert({
          meter_id: meter.meter_id,
          command: "set_state",
          value: newState,
          status: "pending"
        });

      if (error) throw error;

      toast.success(`Kommando sendt til ${meter.meter_id} - ${newState === "ON" ? "tænder" : "slukker"}...`);
    } catch (error) {
      console.error("Error toggling power:", error);
      toast.error("Fejl ved strøm toggle");
    }
  };

  const handleBulkTogglePower = async (turnOn: boolean) => {
    if (selectedMeters.length === 0) {
      toast.error("Vælg målere først");
      return;
    }

    // TODO: Implement MQTT bulk toggle
    toast.info(`${selectedMeters.length} målere ${turnOn ? "tændt" : "slukket"}`);
    setSelectedMeters([]);
  };


  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      ledig: { label: "Ledig", variant: "default" },
      optaget: { label: "Optaget", variant: "secondary" },
      i_stykker: { label: "I stykker", variant: "destructive" },
      ikke_navngivet: { label: "Ikke navngivet", variant: "outline" },
    };

    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const toggleMeterSelection = (meterId: string) => {
    setSelectedMeters((prev) =>
      prev.includes(meterId)
        ? prev.filter((id) => id !== meterId)
        : [...prev, meterId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Indlæser...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full animate-fade-in">
        {isStaffView ? <StaffSidebar /> : <AdminSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="h-14 sm:h-16 border-b bg-background flex items-center px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <h1 className="text-lg sm:text-2xl font-bold ml-4">Målere</h1>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 overflow-auto">
            <Card className="animate-scale-in">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-base sm:text-lg">Måler oversigt</CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={fetchMeters} variant="outline" className="min-h-[44px]">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Opdater</span>
                      <span className="sm:hidden">Opdater</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Input
                        placeholder="Søg efter navn, nummer eller entity..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        aria-label="Søg målere"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filtrer efter status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="all">Alle status</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="on">Tændt</SelectItem>
                      <SelectItem value="off">Slukket</SelectItem>
                      <SelectItem value="occupied">Optaget</SelectItem>
                      <SelectItem value="available">Ledig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk Actions */}
                {selectedMeters.length > 0 && (
                  <div className="mb-4 p-4 bg-muted rounded-lg flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {selectedMeters.length} valgt
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkTogglePower(true)}
                    >
                      Tænd alle
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkTogglePower(false)}
                    >
                      Sluk alle
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedMeters([])}
                    >
                      Ryd valg
                    </Button>
                  </div>
                )}

                {/* Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              selectedMeters.length === filteredMeters.length &&
                              filteredMeters.length > 0
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMeters(filteredMeters.map((m) => m.meter_id));
                              } else {
                                setSelectedMeters([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('meter_id')}
                        >
                          <div className="flex items-center">
                            Måler ID
                            <SortIcon column="meter_id" />
                          </div>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Optaget/Ledig</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('power')}
                        >
                          <div className="flex items-center">
                            Effekt (W)
                            <SortIcon column="power" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('current')}
                        >
                          <div className="flex items-center">
                            Strøm (A)
                            <SortIcon column="current" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('voltage')}
                        >
                          <div className="flex items-center">
                            Spænding (V)
                            <SortIcon column="voltage" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('energy')}
                        >
                          <div className="flex items-center">
                            Energi (kWh)
                            <SortIcon column="energy" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('linkquality')}
                        >
                          <div className="flex items-center">
                            Signal
                            <SortIcon column="linkquality" />
                          </div>
                        </TableHead>
                        <TableHead>Sidst set</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMeters.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-muted-foreground">
                            Ingen målere fundet
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMeters.map((meter) => {
                          // Parse last_seen for "sidst set" display
                          const lastSeenDate = meter.last_seen ? new Date(meter.last_seen) : null;
                          const lastSeenTime = lastSeenDate && !isNaN(lastSeenDate.getTime()) ? lastSeenDate.getTime() : 0;
                          const secondsAgo = lastSeenTime > 0 ? Math.floor((Date.now() - lastSeenTime) / 1000) : 999999999;
                          
                          return (
                            <TableRow 
                              key={meter.meter_id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`${isStaffView ? '/staff' : '/admin'}/maalere/${encodeURIComponent(meter.meter_id)}`)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedMeters.includes(meter.meter_id)}
                                  onCheckedChange={() => toggleMeterSelection(meter.meter_id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {meter.meter_id}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Badge variant={meter.is_online ? "default" : "destructive"}>
                                    {meter.is_online ? "Online" : "Offline"}
                                  </Badge>
                                  {meter.state && (
                                    <Badge variant={meter.state === "ON" ? "default" : "secondary"}>
                                      {meter.state}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={meter.is_available ? "secondary" : "default"}>
                                  {meter.is_available ? "Ledig" : "Optaget"}
                                </Badge>
                              </TableCell>
                              <TableCell>{meter.power.toFixed(1)}</TableCell>
                              <TableCell>{meter.current.toFixed(2)}</TableCell>
                              <TableCell>{meter.voltage.toFixed(0)}</TableCell>
                              <TableCell>{meter.energy.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant={meter.linkquality > 80 ? "default" : meter.linkquality > 50 ? "secondary" : "destructive"}>
                                  {meter.linkquality}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {!meter.last_seen ? 
                                  'Aldrig' :
                                  secondsAgo < 60 ? `${secondsAgo}s siden` : 
                                  secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)}m siden` :
                                  secondsAgo < 86400 ? `${Math.floor(secondsAgo / 3600)}t siden` :
                                  `${Math.floor(secondsAgo / 86400)}d siden`}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-background z-50">
                                    <DropdownMenuItem
                                      onClick={() => handleTogglePower(meter)}
                                    >
                                      <Power className="mr-2 h-4 w-4" />
                                      Tænd/sluk
                                    </DropdownMenuItem>
                                    {!meter.is_online && !isStaffView && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setDeleteMeter(meter);
                                          setShowDeleteModal(true);
                                        }}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Slet måler
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
          </main>
        </div>
      </div>

      {/* Add Meter Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Tilføj ny måler</DialogTitle>
            <DialogDescription>
              Indtast navn og måler-ID for den nye måler
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="meter-name">Måler navn</Label>
              <Input
                id="meter-name"
                placeholder="Stander 512"
                value={newMeterName}
                onChange={(e) => setNewMeterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meter-entity">HA Entity ID</Label>
              <Input
                id="meter-entity"
                placeholder="sensor.meter_power_512"
                value={newMeterEntity}
                onChange={(e) => setNewMeterEntity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleAddMeter}>Tilføj måler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Meter Modal */}
      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Omdøb måler</DialogTitle>
            <DialogDescription>
              Indtast nyt navn for måleren
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-value">Nyt navn</Label>
              <div className="relative">
                <Input
                  id="rename-value"
                  placeholder="Stander 512"
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    checkNameAvailability(e.target.value);
                  }}
                />
                {nameAvailable !== null && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {nameAvailable ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              {nameAvailable === false && (
                <p className="text-sm text-destructive">Dette navn er allerede i brug</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleRenameMeter} disabled={!nameAvailable}>
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Meter Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Slet måler</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette måleren "{deleteMeter?.meter_id}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium">Advarsel</p>
                <p className="text-sm text-muted-foreground">
                  Alle historiske data for denne måler vil blive slettet permanent. Denne handling kan ikke fortrydes.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Annuller
            </Button>
            <Button variant="destructive" onClick={handleDeleteMeter}>
              Slet måler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discover Meters Modal */}
      <Dialog open={showDiscoverModal} onOpenChange={setShowDiscoverModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Nye målere fundet</DialogTitle>
            <DialogDescription>
              Følgende målere blev fundet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {discoveredMeters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen nye målere fundet</p>
            ) : (
              discoveredMeters.map((entity) => (
                <div
                  key={entity}
                  className="p-3 border rounded-lg flex items-center justify-between"
                >
                  <span className="font-mono text-sm">{entity}</span>
                  <Button size="sm" variant="outline">
                    Tilføj
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDiscoverModal(false)}>Luk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default AdminMaalere;
