import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  RefreshCw, 
  Zap,
  ZapOff,
  Link as LinkIcon,
  Unlink,
  Search,
  CircuitBoard,
} from "lucide-react";

interface PowerStand {
  id: string;
  name: string;
  map_x: number | null;
  map_y: number | null;
  map_locked: boolean;
  created_at: string;
  meters: Meter[];
  fuse_group_id: string | null;
  fuse_group_name?: string;
  board_name?: string;
}

interface FuseGroup {
  id: string;
  group_number: number;
  name: string | null;
  fuse_rating: string | null;
  board_id: string;
  board_name: string;
}

interface Meter {
  id: string;
  meter_number: string;
  is_online: boolean;
  stand_id: string | null;
}

const Standere = () => {
  const [stands, setStands] = useState<PowerStand[]>([]);
  const [unassignedMeters, setUnassignedMeters] = useState<Meter[]>([]);
  const [fuseGroups, setFuseGroups] = useState<FuseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStandName, setNewStandName] = useState("");
  const [newStandFuseGroup, setNewStandFuseGroup] = useState<string>("");
  const [editingStand, setEditingStand] = useState<PowerStand | null>(null);
  const [editName, setEditName] = useState("");
  const [editFuseGroup, setEditFuseGroup] = useState<string>("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedStand, setSelectedStand] = useState<PowerStand | null>(null);
  const [meterSearch, setMeterSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Hent alle standere
      const { data: standsData, error: standsError } = await (supabase as any)
        .from("power_stands")
        .select("*")
        .order("name");

      if (standsError) throw standsError;

      // Hent alle målere med stand_id
      const { data: metersData, error: metersError } = await (supabase as any)
        .from("power_meters")
        .select("id, meter_number, is_online, stand_id")
        .order("meter_number");

      if (metersError) throw metersError;

      // Hent sikringsgrupper med undertavle-info
      const { data: fuseGroupsData } = await (supabase as any)
        .from("fuse_groups")
        .select("*")
        .order("group_number");

      // Hent undertavler
      const { data: boardsData } = await (supabase as any)
        .from("distribution_boards")
        .select("id, name, board_number");

      // Byg fuseGroups med board_name
      const boardsMap = new Map((boardsData || []).map((b: any) => [b.id, b]));
      const enrichedFuseGroups: FuseGroup[] = (fuseGroupsData || []).map((fg: any) => {
        const board = boardsMap.get(fg.board_id);
        return {
          ...fg,
          board_name: board ? board.name : "Ukendt tavle"
        };
      });
      setFuseGroups(enrichedFuseGroups);

      // Byg map af fuse_group_id til info
      const fuseGroupMap = new Map(enrichedFuseGroups.map(fg => [fg.id, fg]));

      // Hent hytter for at identificere hytte-målere
      const { data: cabinsData } = await (supabase as any)
        .from("cabins")
        .select("meter_id")
        .eq("is_active", true);
      
      // Lav et Set af hytte-måler numre + repeatere (skal ikke vises i stander-listen)
      const cabinMeterNumbers = new Set(
        (cabinsData || [])
          .map((c: any) => c.meter_id)
          .filter((id: string | null) => id !== null)
      );

      // Gruppér målere efter stand_id
      const metersByStand: Record<string, Meter[]> = {};
      const unassigned: Meter[] = [];

      (metersData || []).forEach((meter: Meter) => {
        // Skip hytte-målere og repeatere - de skal ikke vises i stander-listen
        const isCabinMeter = cabinMeterNumbers.has(meter.meter_number);
        const isRepeater = meter.meter_number.toLowerCase().includes("repeater");
        
        if (isCabinMeter || isRepeater) {
          return; // Skip denne måler
        }
        
        if (meter.stand_id) {
          if (!metersByStand[meter.stand_id]) {
            metersByStand[meter.stand_id] = [];
          }
          metersByStand[meter.stand_id].push(meter);
        } else {
          unassigned.push(meter);
        }
      });

      // Tilføj målere og sikringsgruppe-info til standere
      const standsWithMeters = (standsData || []).map((stand: any) => {
        const fuseGroup = stand.fuse_group_id ? fuseGroupMap.get(stand.fuse_group_id) : null;
        return {
          ...stand,
          meters: metersByStand[stand.id] || [],
          fuse_group_name: fuseGroup ? `Gruppe ${fuseGroup.group_number}${fuseGroup.name ? ` (${fuseGroup.name})` : ""}` : null,
          board_name: fuseGroup?.board_name || null,
        };
      });

      setStands(standsWithMeters);
      setUnassignedMeters(unassigned);
    } catch (error) {
      console.error("Fejl ved hentning:", error);
      toast.error("Kunne ikke hente data");
    } finally {
      setLoading(false);
    }
  };

  const createStand = async () => {
    if (!newStandName.trim()) {
      toast.error("Indtast et navn");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("power_stands")
        .insert({ 
          name: newStandName.trim(),
          fuse_group_id: newStandFuseGroup === "none" ? null : (newStandFuseGroup || null)
        });

      if (error) throw error;

      toast.success(`Stander "${newStandName}" oprettet`);
      setNewStandName("");
      setNewStandFuseGroup("");
      fetchData();
    } catch (error) {
      console.error("Fejl ved oprettelse:", error);
      toast.error("Kunne ikke oprette stander");
    }
  };

  const updateStand = async () => {
    if (!editingStand || !editName.trim()) return;

    try {
      const { error } = await (supabase as any)
        .from("power_stands")
        .update({ 
          name: editName.trim(),
          fuse_group_id: editFuseGroup === "none" ? null : (editFuseGroup || null)
        })
        .eq("id", editingStand.id);

      if (error) throw error;

      toast.success("Stander opdateret");
      setEditingStand(null);
      setEditName("");
      setEditFuseGroup("");
      fetchData();
    } catch (error) {
      console.error("Fejl ved opdatering:", error);
      toast.error("Kunne ikke opdatere stander");
    }
  };

  const deleteStand = async (stand: PowerStand) => {
    if (stand.meters.length > 0) {
      toast.error("Fjern først alle målere fra standeren");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("power_stands")
        .delete()
        .eq("id", stand.id);

      if (error) throw error;

      toast.success(`Stander "${stand.name}" slettet`);
      fetchData();
    } catch (error) {
      console.error("Fejl ved sletning:", error);
      toast.error("Kunne ikke slette stander");
    }
  };

  const assignMeter = async (meterId: string, standId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("power_meters")
        .update({ stand_id: standId })
        .eq("id", meterId);

      if (error) throw error;

      // Find den tilknyttede måler
      const assignedMeter = unassignedMeters.find(m => m.id === meterId);
      
      if (assignedMeter) {
        // Opdater lokalt: Fjern fra ikke-tildelte
        setUnassignedMeters(prev => prev.filter(m => m.id !== meterId));
        
        // Opdater lokalt: Tilføj til stander
        setStands(prev => prev.map(s => {
          if (s.id === standId) {
            return { ...s, meters: [...s.meters, { ...assignedMeter, stand_id: standId }] };
          }
          return s;
        }));
        
        // Opdater selectedStand så dialogen viser korrekt
        setSelectedStand(prev => {
          if (prev && prev.id === standId) {
            return { ...prev, meters: [...prev.meters, { ...assignedMeter, stand_id: standId }] };
          }
          return prev;
        });
      }

      toast.success("Måler tilknyttet stander");
      // Dialog forbliver åben så brugeren kan tilføje flere
    } catch (error) {
      console.error("Fejl ved tilknytning:", error);
      toast.error("Kunne ikke tilknytte måler");
    }
  };

  const unassignMeter = async (meterId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("power_meters")
        .update({ stand_id: null })
        .eq("id", meterId);

      if (error) throw error;

      // Find måleren der skal fjernes
      let removedMeter: Meter | undefined;
      
      // Opdater lokalt: Fjern fra stander
      setStands(prev => prev.map(s => {
        const meter = s.meters.find(m => m.id === meterId);
        if (meter) {
          removedMeter = { ...meter, stand_id: null };
          return { ...s, meters: s.meters.filter(m => m.id !== meterId) };
        }
        return s;
      }));
      
      // Opdater selectedStand så dialogen viser korrekt
      setSelectedStand(prev => {
        if (prev) {
          const meter = prev.meters.find(m => m.id === meterId);
          if (meter) {
            removedMeter = { ...meter, stand_id: null };
          }
          return { ...prev, meters: prev.meters.filter(m => m.id !== meterId) };
        }
        return prev;
      });
      
      // Tilføj til ikke-tildelte
      if (removedMeter) {
        setUnassignedMeters(prev => [...prev, removedMeter!].sort((a, b) => 
          a.meter_number.localeCompare(b.meter_number)
        ));
      }

      toast.success("Måler fjernet fra stander");
    } catch (error) {
      console.error("Fejl ved fjernelse:", error);
      toast.error("Kunne ikke fjerne måler");
    }
  };

  const getStandStatus = (stand: PowerStand) => {
    if (stand.meters.length === 0) return { color: "bg-gray-500", text: "Ingen målere" };
    const onlineCount = stand.meters.filter((m) => m.is_online).length;
    if (onlineCount === stand.meters.length) return { color: "bg-green-500", text: "Alle online" };
    if (onlineCount === 0) return { color: "bg-red-500", text: "Alle offline" };
    return { color: "bg-yellow-500", text: `${onlineCount}/${stand.meters.length} online` };
  };

  const filteredUnassigned = unassignedMeters.filter((m) =>
    m.meter_number.toLowerCase().includes(meterSearch.toLowerCase())
  );

  const totalMeters = stands.reduce((sum, s) => sum + s.meters.length, 0) + unassignedMeters.length;
  const assignedMeters = stands.reduce((sum, s) => sum + s.meters.length, 0);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold">Strømstandere</h1>
                  <p className="text-muted-foreground text-sm">
                    {stands.length} standere | {assignedMeters}/{totalMeters} målere tildelt
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Opdater
              </Button>
            </div>
          </header>

          <div className="flex-1 p-6 space-y-6">
            {/* Opret ny stander */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Opret ny stander</CardTitle>
                <CardDescription>
                  En strømstander repræsenterer en fysisk stander med én eller flere målere
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Navn på stander (f.eks. 'Stander 101-104')"
                    value={newStandName}
                    onChange={(e) => setNewStandName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createStand()}
                    className="flex-1 min-w-[200px]"
                  />
                  <Select value={newStandFuseGroup} onValueChange={setNewStandFuseGroup}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Vælg sikringsgruppe (valgfrit)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen sikringsgruppe</SelectItem>
                      {fuseGroups.map((fg) => (
                        <SelectItem key={fg.id} value={fg.id}>
                          <span className="flex items-center gap-2">
                            <CircuitBoard className="h-3 w-3" />
                            {fg.board_name} - Gruppe {fg.group_number}
                            {fg.name && ` (${fg.name})`}
                            {fg.fuse_rating && ` [${fg.fuse_rating}]`}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={createStand}>
                    <Plus className="h-4 w-4 mr-2" />
                    Opret
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Ikke-tildelte målere */}
            {unassignedMeters.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg text-orange-800">
                    Ikke-tildelte målere ({unassignedMeters.length})
                  </CardTitle>
                  <CardDescription className="text-orange-600">
                    Disse målere er ikke tilknyttet nogen stander endnu
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {unassignedMeters.slice(0, 20).map((meter) => (
                      <Badge
                        key={meter.id}
                        variant="outline"
                        className={`${meter.is_online ? "border-green-500 text-green-700" : "border-red-500 text-red-700"}`}
                      >
                        {meter.is_online ? <Zap className="h-3 w-3 mr-1" /> : <ZapOff className="h-3 w-3 mr-1" />}
                        {meter.meter_number}
                      </Badge>
                    ))}
                    {unassignedMeters.length > 20 && (
                      <Badge variant="secondary">+{unassignedMeters.length - 20} mere</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Liste over standere */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alle standere</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stands.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Ingen standere oprettet endnu
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Navn</TableHead>
                        <TableHead>Sikringsgruppe</TableHead>
                        <TableHead>Målere</TableHead>
                        <TableHead>Online/Offline</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stands.map((stand) => {
                        const status = getStandStatus(stand);
                        return (
                          <TableRow key={stand.id}>
                            <TableCell>
                              <div className={`w-4 h-4 rounded-full ${status.color}`} title={status.text} />
                            </TableCell>
                            <TableCell className="font-medium">{stand.name}</TableCell>
                            <TableCell>
                              {stand.fuse_group_name ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium flex items-center gap-1">
                                    <CircuitBoard className="h-3 w-3 text-muted-foreground" />
                                    {stand.fuse_group_name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{stand.board_name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Ikke tildelt</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {stand.meters.length === 0 ? (
                                  <span className="text-muted-foreground text-sm">Ingen målere</span>
                                ) : (
                                  stand.meters.map((meter) => (
                                    <Badge
                                      key={meter.id}
                                      variant="outline"
                                      className={`text-xs ${meter.is_online ? "border-green-500" : "border-red-500"}`}
                                    >
                                      {meter.meter_number}
                                      <button
                                        onClick={() => unassignMeter(meter.id)}
                                        className="ml-1 hover:text-red-500"
                                        title="Fjern fra stander"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{status.text}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedStand(stand);
                                      setAssignDialogOpen(true);
                                    }}
                                  >
                                    <LinkIcon className="h-4 w-4 mr-2" />
                                    Tilføj måler
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingStand(stand);
                                      setEditName(stand.name);
                                      setEditFuseGroup(stand.fuse_group_id || "");
                                    }}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Rediger
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => deleteStand(stand)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Slet
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Dialog: Omdøb stander */}
      <Dialog open={!!editingStand} onOpenChange={(open) => !open && setEditingStand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger stander</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Navn</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Stander navn"
              />
            </div>
            <div>
              <Label>Sikringsgruppe</Label>
              <Select value={editFuseGroup} onValueChange={setEditFuseGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg sikringsgruppe (valgfrit)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen sikringsgruppe</SelectItem>
                  {fuseGroups.map((fg) => (
                    <SelectItem key={fg.id} value={fg.id}>
                      <span className="flex items-center gap-2">
                        <CircuitBoard className="h-3 w-3" />
                        {fg.board_name} - Gruppe {fg.group_number}
                        {fg.name && ` (${fg.name})`}
                        {fg.fuse_rating && ` [${fg.fuse_rating}]`}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuller</Button>
            </DialogClose>
            <Button onClick={updateStand}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Tilføj måler til stander */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Administrer målere for "{selectedStand?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Tilknyttede målere */}
            {selectedStand && selectedStand.meters.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Tilknyttede målere ({selectedStand.meters.length})
                </Label>
                <div className="space-y-1 mb-4">
                  {selectedStand.meters.map((meter) => (
                    <div
                      key={meter.id}
                      className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {meter.is_online ? (
                          <Zap className="h-4 w-4 text-green-500" />
                        ) : (
                          <ZapOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{meter.meter_number}</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => unassignMeter(meter.id)}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Søg og tilføj nye målere */}
            <div>
              <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                Tilføj flere målere
              </Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg efter måler..."
                  value={meterSearch}
                  onChange={(e) => setMeterSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredUnassigned.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Ingen ledige målere fundet
                  </p>
                ) : (
                  filteredUnassigned.map((meter) => (
                    <div
                      key={meter.id}
                      className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => {
                        if (selectedStand) {
                          assignMeter(meter.id, selectedStand.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {meter.is_online ? (
                          <Zap className="h-4 w-4 text-green-500" />
                        ) : (
                          <ZapOff className="h-4 w-4 text-red-500" />
                        )}
                        <span>{meter.meter_number}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Luk</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Standere;
