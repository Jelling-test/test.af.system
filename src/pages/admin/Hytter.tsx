import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Home,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface Cabin {
  id: string;
  cabin_number: string;
  name: string;
  cabin_type: string | null;
  meter_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Meter {
  meter_number: string;
  is_online: boolean;
  is_cabin_meter: boolean;
}

const CABIN_TYPES = [
  "Vandre hytte med toilet",
  "hytte uden toilet",
  "luksus hytte",
  "Mobile Home 4 personer",
  "mobile 6 personer",
];

const AdminHytter = () => {
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [filteredCabins, setFilteredCabins] = useState<Cabin[]>([]);
  const [availableMeters, setAvailableMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form states
  const [editingCabin, setEditingCabin] = useState<Cabin | null>(null);
  const [formData, setFormData] = useState({
    cabin_number: "",
    name: "",
    cabin_type: "",
    meter_id: "",
  });

  useEffect(() => {
    fetchCabins();
    fetchAvailableMeters();
  }, []);

  useEffect(() => {
    filterCabins();
  }, [cabins, searchTerm]);

  const fetchCabins = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("cabins")
        .select("*")
        .order("cabin_number", { ascending: true });

      if (error) throw error;

      // Sort numerically
      const sorted = (data || []).sort((a: Cabin, b: Cabin) => {
        const numA = parseInt(a.cabin_number) || 0;
        const numB = parseInt(b.cabin_number) || 0;
        return numA - numB;
      });

      setCabins(sorted);
    } catch (error) {
      console.error("Error fetching cabins:", error);
      toast.error("Fejl ved hentning af hytter");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableMeters = async () => {
    try {
      // Get all meters
      const { data: allMeters, error: metersError } = await (supabase as any)
        .from("power_meters")
        .select("meter_number")
        .order("meter_number", { ascending: true });

      if (metersError) throw metersError;

      // Get meters already assigned to cabins
      const { data: cabinMeters } = await (supabase as any)
        .from("cabins")
        .select("meter_id")
        .not("meter_id", "is", null);

      const assignedMeterIds = new Set(cabinMeters?.map((c: any) => c.meter_id) || []);

      // Check online status
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const metersWithStatus = await Promise.all(
        (allMeters || []).map(async (meter: any) => {
          const { data: latestReading } = await (supabase as any)
            .from("meter_readings")
            .select("time")
            .eq("meter_id", meter.meter_number)
            .order("time", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            meter_number: meter.meter_number,
            is_online: latestReading && latestReading.time > fiveMinutesAgo,
            is_cabin_meter: assignedMeterIds.has(meter.meter_number),
          };
        })
      );

      setAvailableMeters(metersWithStatus);
    } catch (error) {
      console.error("Error fetching meters:", error);
    }
  };

  const filterCabins = () => {
    if (!searchTerm) {
      setFilteredCabins(cabins);
      return;
    }

    const filtered = cabins.filter(
      (c) =>
        c.cabin_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.meter_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCabins(filtered);
  };

  const handleAdd = () => {
    setFormData({
      cabin_number: "",
      name: "",
      cabin_type: "",
      meter_id: "",
    });
    setShowAddModal(true);
  };

  const handleEdit = (cabin: Cabin) => {
    setEditingCabin(cabin);
    setFormData({
      cabin_number: cabin.cabin_number,
      name: cabin.name,
      cabin_type: cabin.cabin_type || "",
      meter_id: cabin.meter_id || "",
    });
    setShowEditModal(true);
  };

  const handleDelete = (cabin: Cabin) => {
    setEditingCabin(cabin);
    setShowDeleteDialog(true);
  };

  const handleSaveNew = async () => {
    if (!formData.cabin_number || !formData.name) {
      toast.error("Hytte nummer og navn er påkrævet");
      return;
    }

    try {
      const { error } = await (supabase as any).from("cabins").insert({
        cabin_number: formData.cabin_number,
        name: formData.name,
        cabin_type: formData.cabin_type || null,
        meter_id: formData.meter_id && formData.meter_id !== "none" ? formData.meter_id : null,
        is_active: true,
      });

      if (error) throw error;

      toast.success(`Hytte ${formData.name} oprettet`);
      setShowAddModal(false);
      fetchCabins();
      fetchAvailableMeters();
    } catch (error: any) {
      console.error("Error creating cabin:", error);
      if (error.code === "23505") {
        toast.error("Hytte nummer findes allerede");
      } else {
        toast.error("Fejl ved oprettelse af hytte");
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCabin || !formData.name) {
      toast.error("Navn er påkrævet");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("cabins")
        .update({
          name: formData.name,
          cabin_type: formData.cabin_type || null,
          meter_id: formData.meter_id && formData.meter_id !== "none" ? formData.meter_id : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingCabin.id);

      if (error) throw error;

      toast.success(`Hytte ${formData.name} opdateret`);
      setShowEditModal(false);
      setEditingCabin(null);
      fetchCabins();
      fetchAvailableMeters();
    } catch (error) {
      console.error("Error updating cabin:", error);
      toast.error("Fejl ved opdatering af hytte");
    }
  };

  const handleConfirmDelete = async () => {
    if (!editingCabin) return;

    try {
      const { error } = await (supabase as any)
        .from("cabins")
        .delete()
        .eq("id", editingCabin.id);

      if (error) throw error;

      toast.success(`Hytte ${editingCabin.name} slettet`);
      setShowDeleteDialog(false);
      setEditingCabin(null);
      fetchCabins();
      fetchAvailableMeters();
    } catch (error) {
      console.error("Error deleting cabin:", error);
      toast.error("Fejl ved sletning af hytte");
    }
  };

  const getMeterStatus = (meterId: string | null) => {
    if (!meterId) return null;
    const meter = availableMeters.find((m) => m.meter_number === meterId);
    return meter;
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="flex items-center gap-2 mb-6">
            <SidebarTrigger />
            <h1 className="text-2xl font-bold">Hytter</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Antal hytter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cabins.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Med måler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {cabins.filter((c) => c.meter_id).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Uden måler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {cabins.filter((c) => !c.meter_id).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg efter hytte nummer, navn eller måler..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Opret hytte
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Indlæser...
                </div>
              ) : filteredCabins.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {cabins.length === 0
                      ? "Ingen hytter oprettet endnu"
                      : "Ingen hytter matcher søgningen"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Måler</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCabins.map((cabin) => {
                      const meterStatus = getMeterStatus(cabin.meter_id);
                      return (
                        <TableRow key={cabin.id}>
                          <TableCell className="font-medium">
                            {cabin.cabin_number}
                          </TableCell>
                          <TableCell>{cabin.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {cabin.cabin_type || "-"}
                          </TableCell>
                          <TableCell>
                            {cabin.meter_id ? (
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                <span>{cabin.meter_id}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!cabin.meter_id ? (
                              <Badge variant="outline" className="text-orange-600 border-orange-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Ingen måler
                              </Badge>
                            ) : meterStatus?.is_online ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500">
                                Offline
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(cabin)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(cabin)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add Modal */}
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Opret ny hytte</DialogTitle>
                <DialogDescription>
                  Opret en ny hytte og tildel en fast måler
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="cabin_number">Hytte nummer *</Label>
                  <Input
                    id="cabin_number"
                    placeholder="f.eks. 1, 2, 3..."
                    value={formData.cabin_number}
                    onChange={(e) =>
                      setFormData({ ...formData, cabin_number: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Skal matche RoomName fra booking-systemet
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Navn *</Label>
                  <Input
                    id="name"
                    placeholder="f.eks. Hytte 1"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cabin_type">Type</Label>
                  <Select
                    value={formData.cabin_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cabin_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CABIN_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meter_id">Måler</Label>
                  <Select
                    value={formData.meter_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, meter_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg måler..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen måler</SelectItem>
                      {availableMeters
                        .filter((m) => !m.is_cabin_meter)
                        .map((meter) => (
                          <SelectItem
                            key={meter.meter_number}
                            value={meter.meter_number}
                          >
                            {meter.meter_number}{" "}
                            {meter.is_online ? "(online)" : "(offline)"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Kun ledige målere vises (ikke allerede tildelt en hytte)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Annuller
                </Button>
                <Button onClick={handleSaveNew}>Opret hytte</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rediger hytte</DialogTitle>
                <DialogDescription>
                  Rediger hytte {editingCabin?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_number">Hytte nummer</Label>
                  <Input
                    id="edit_number"
                    value={formData.cabin_number}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hytte nummer kan ikke ændres
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Navn *</Label>
                  <Input
                    id="edit_name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_type">Type</Label>
                  <Select
                    value={formData.cabin_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cabin_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CABIN_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_meter">Måler</Label>
                  <Select
                    value={formData.meter_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, meter_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg måler..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen måler</SelectItem>
                      {availableMeters
                        .filter(
                          (m) =>
                            !m.is_cabin_meter ||
                            m.meter_number === editingCabin?.meter_id
                        )
                        .map((meter) => (
                          <SelectItem
                            key={meter.meter_number}
                            value={meter.meter_number}
                          >
                            {meter.meter_number}{" "}
                            {meter.is_online ? "(online)" : "(offline)"}
                            {meter.meter_number === editingCabin?.meter_id
                              ? " (nuværende)"
                              : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Annuller
                </Button>
                <Button onClick={handleSaveEdit}>Gem ændringer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <AlertDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slet hytte?</AlertDialogTitle>
                <AlertDialogDescription>
                  Er du sikker på du vil slette {editingCabin?.name}? Denne
                  handling kan ikke fortrydes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuller</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Slet hytte
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminHytter;
