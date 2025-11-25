import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, RefreshCw, Calculator, AlertTriangle, Edit, Plus, Trash2 } from "lucide-react";

interface Package {
  id: string;
  data: {
    navn: string;
    enheder: number;
    pris_dkk: number;
    stripe_price_id?: string;
    aktiv: string;
    kunde_type?: string;
    pakke_kategori: string;
  };
}

const AdminPriser = () => {
  const [loading, setLoading] = useState(true);
  const [basisPris, setBasisPris] = useState<number>(4.5);
  const [newBasisPris, setNewBasisPris] = useState<string>("4.5");
  const [packages, setPackages] = useState<Package[]>([]);
  const [systemSettingsId, setSystemSettingsId] = useState<string | null>(null);
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [showBulkRecalcDialog, setShowBulkRecalcDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [syncing, setSyncing] = useState(false);
  
  // Create package form
  const [newPackageName, setNewPackageName] = useState("");
  const [newPackageUnits, setNewPackageUnits] = useState("");
  const [newPackageCustomerType, setNewPackageCustomerType] = useState("sæson");
  const [newPackageType, setNewPackageType] = useState("startpakke");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch system settings for basis price
      const { data: settingsData, error: settingsError } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "system_settings")
        .eq("ref_id", "global")
        .maybeSingle();

      if (settingsError) throw settingsError;

      if (settingsData) {
        const basis = settingsData.data?.basis_pris || 4.5;
        setBasisPris(basis);
        setNewBasisPris(basis.toString());
        setSystemSettingsId(settingsData.id);
      }

      // Fetch all packages
      const { data: packagesData, error: packagesError } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakke_typer")
        .order("created_at", { ascending: true });

      if (packagesError) throw packagesError;

      setPackages(packagesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Fejl ved hentning af data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBasisPris = async () => {
    const newValue = parseFloat(newBasisPris);
    if (isNaN(newValue) || newValue <= 0) {
      toast.error("Indtast en gyldig pris");
      return;
    }

    try {
      if (systemSettingsId) {
        // Update existing settings
        const { error } = await (supabase as any)
          .from("plugin_data")
          .update({
            data: { basis_pris: newValue },
          })
          .eq("id", systemSettingsId);

        if (error) throw error;
      } else {
        // Create new settings
        const { data, error } = await (supabase as any)
          .from("plugin_data")
          .insert({
            organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            module: "system_settings",
            ref_id: "global",
            data: { basis_pris: newValue },
          })
          .select()
          .single();

        if (error) throw error;
        setSystemSettingsId(data.id);
      }

      setBasisPris(newValue);
      
      // Automatically recalculate all package prices
      const updates = packages.map((pkg) => {
        const calculatedPrice = pkg.data.enheder * newValue;
        return (supabase as any)
          .from("plugin_data")
          .update({
            data: {
              ...pkg.data,
              pris_dkk: calculatedPrice,
            },
          })
          .eq("id", pkg.id);
      });

      await Promise.all(updates);
      
      toast.success("Basis pris opdateret og alle pakkepriser genberegnet");
      fetchData();
    } catch (error) {
      console.error("Error updating basis price:", error);
      toast.error("Fejl ved opdatering af basis pris");
    }
  };

  const handleEditPrice = (pkg: Package) => {
    setEditingPackage(pkg);
    setEditPrice(pkg.data.pris_dkk.toString());
    setShowEditModal(true);
  };

  const handleSavePrice = async () => {
    if (!editingPackage) return;

    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      toast.error("Indtast en gyldig pris");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("plugin_data")
        .update({
          data: {
            ...editingPackage.data,
            pris_dkk: newPrice,
          },
        })
        .eq("id", editingPackage.id);

      if (error) throw error;

      toast.success("Pris opdateret");
      setShowEditModal(false);
      setEditingPackage(null);
      setEditPrice("");
      fetchData();
    } catch (error) {
      console.error("Error updating price:", error);
      toast.error("Fejl ved opdatering af pris");
    }
  };

  const handleCreatePackage = async () => {
    const units = parseFloat(newPackageUnits);
    if (!newPackageName.trim() || isNaN(units) || units <= 0) {
      toast.error("Indtast gyldigt pakkenavn og antal enheder");
      return;
    }

    try {
      const calculatedPrice = units * basisPris;
      
      const refId = crypto.randomUUID();
      const { error } = await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "pakke_typer",
          ref_id: refId,
          key: `pakke_type_${refId}`,
          data: {
            navn: newPackageName.trim(),
            enheder: units,
            pris_dkk: calculatedPrice,
            aktiv: "true",
            kunde_type: newPackageCustomerType,
            pakke_kategori: newPackageType,
          },
        });

      if (error) throw error;

      toast.success("Pakke oprettet");
      setShowCreateModal(false);
      setNewPackageName("");
      setNewPackageUnits("");
      setNewPackageCustomerType("sæson");
      setNewPackageType("startpakke");
      fetchData();
    } catch (error) {
      console.error("Error creating package:", error);
      toast.error("Fejl ved oprettelse af pakke");
    }
  };

  const handleDeletePackage = async () => {
    if (!packageToDelete) return;

    try {
      const { error } = await (supabase as any)
        .from("plugin_data")
        .delete()
        .eq("id", packageToDelete.id);

      if (error) throw error;

      toast.success("Pakke slettet");
      setShowDeleteDialog(false);
      setPackageToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting package:", error);
      toast.error("Fejl ved sletning af pakke");
    }
  };

  const handleBulkRecalculate = async () => {
    try {
      const updates = packages.map((pkg) => {
        const calculatedPrice = pkg.data.enheder * basisPris;
        return (supabase as any)
          .from("plugin_data")
          .update({
            data: {
              ...pkg.data,
              pris_dkk: calculatedPrice,
            },
          })
          .eq("id", pkg.id);
      });

      await Promise.all(updates);

      toast.success("Alle priser genberegnet");
      setShowBulkRecalcDialog(false);
      fetchData();
    } catch (error) {
      console.error("Error bulk recalculating:", error);
      toast.error("Fejl ved genberegning");
    }
  };

  const handleSyncWithStripe = async () => {
    setSyncing(true);
    try {
      // TODO: Call edge function to sync prices with Stripe
      // This would create/update Stripe prices and update stripe_price_id in database
      
      toast.info("Stripe synkronisering ikke implementeret endnu");
      
      // Mock implementation:
      // const { error } = await supabase.functions.invoke("sync-stripe-prices", {
      //   body: { packages },
      // });
      // if (error) throw error;
      // toast.success("Priser synkroniseret med Stripe");
      // fetchData();
    } catch (error) {
      console.error("Error syncing with Stripe:", error);
      toast.error("Fejl ved Stripe synkronisering");
    } finally {
      setSyncing(false);
    }
  };

  const getCalculatedPrice = (pkg: Package) => {
    return pkg.data.enheder * basisPris;
  };

  const hasPriceDiscrepancy = (pkg: Package) => {
    const calculated = getCalculatedPrice(pkg);
    return Math.abs(calculated - pkg.data.pris_dkk) > 0.01;
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
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 sm:h-16 border-b bg-background flex items-center px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <h1 className="text-lg sm:text-2xl font-bold ml-4">Pris Administration</h1>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 space-y-4 sm:space-y-6 overflow-auto">
            {/* Basis Price Card */}
            <Card className="animate-scale-in">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Basis Pris</CardTitle>
                <CardDescription>
                  Grundlæggende pris per enhed som bruges til at beregne pakkepriser
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="flex-1 w-full sm:max-w-xs">
                    <Label htmlFor="basis-pris">Pris per enhed (kr)</Label>
                    <Input
                      id="basis-pris"
                      type="number"
                      step="0.1"
                      value={newBasisPris}
                      onChange={(e) => setNewBasisPris(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleUpdateBasisPris} className="min-h-[44px] w-full sm:w-auto">
                    <Save className="mr-2 h-4 w-4" />
                    <span>Opdater</span>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Nuværende basis pris: <strong>{basisPris} kr</strong>
                </p>
              </CardContent>
            </Card>

            {/* Packages Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pakke Priser</CardTitle>
                    <CardDescription>
                      Administrer priser for alle pakker
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateModal(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Opret pakke
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowBulkRecalcDialog(true)}
                    >
                      <Calculator className="mr-2 h-4 w-4" />
                      Genberegn alle
                    </Button>
                    <Button
                      onClick={handleSyncWithStripe}
                      disabled={syncing}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                      Sync med Stripe
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {packages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Ingen pakker fundet
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Kørende Dagspakker */}
                    {packages.filter(p => p.data.kunde_type === 'kørende' && p.data.pakke_kategori === 'dagspakke').length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 px-2">Kørende Dagspakker</h3>
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Pakke navn</TableHead>
                                <TableHead>Enheder</TableHead>
                                <TableHead>Nuværende pris</TableHead>
                                <TableHead>Beregnet pris</TableHead>
                                <TableHead>Stripe Price ID</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {packages
                                .filter(p => p.data.kunde_type === 'kørende' && p.data.pakke_kategori === 'dagspakke')
                                .sort((a, b) => a.data.enheder - b.data.enheder)
                                .map((pkg) => {
                                  const calculatedPrice = getCalculatedPrice(pkg);
                                  const hasDiscrepancy = hasPriceDiscrepancy(pkg);
                                  return (
                                    <TableRow key={pkg.id}>
                                      <TableCell className="font-medium">{pkg.data.navn}</TableCell>
                                      <TableCell>{pkg.data.enheder}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className={hasDiscrepancy ? "text-orange-500 font-medium" : ""}>
                                            {(pkg.data.pris_dkk || 0).toFixed(2)} kr
                                          </span>
                                          {hasDiscrepancy && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">{calculatedPrice.toFixed(2)} kr</TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {pkg.data.stripe_price_id || <span className="text-muted-foreground">-</span>}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" onClick={() => handleEditPrice(pkg)}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => { setPackageToDelete(pkg); setShowDeleteDialog(true); }}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Kørende Tillægspakker */}
                    {packages.filter(p => p.data.kunde_type === 'kørende' && p.data.pakke_kategori === 'tillæg').length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 px-2">Kørende Tillægspakker</h3>
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Pakke navn</TableHead>
                                <TableHead>Enheder</TableHead>
                                <TableHead>Nuværende pris</TableHead>
                                <TableHead>Beregnet pris</TableHead>
                                <TableHead>Stripe Price ID</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {packages
                                .filter(p => p.data.kunde_type === 'kørende' && p.data.pakke_kategori === 'tillæg')
                                .sort((a, b) => a.data.enheder - b.data.enheder)
                                .map((pkg) => {
                                  const calculatedPrice = getCalculatedPrice(pkg);
                                  const hasDiscrepancy = hasPriceDiscrepancy(pkg);
                                  return (
                                    <TableRow key={pkg.id}>
                                      <TableCell className="font-medium">{pkg.data.navn}</TableCell>
                                      <TableCell>{pkg.data.enheder}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className={hasDiscrepancy ? "text-orange-500 font-medium" : ""}>
                                            {(pkg.data.pris_dkk || 0).toFixed(2)} kr
                                          </span>
                                          {hasDiscrepancy && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">{calculatedPrice.toFixed(2)} kr</TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {pkg.data.stripe_price_id || <span className="text-muted-foreground">-</span>}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" onClick={() => handleEditPrice(pkg)}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => { setPackageToDelete(pkg); setShowDeleteDialog(true); }}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Sæson Startpakker */}
                    {packages.filter(p => p.data.kunde_type === 'sæson' && p.data.pakke_kategori === 'startpakke').length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 px-2">Sæson Startpakker</h3>
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Pakke navn</TableHead>
                                <TableHead>Enheder</TableHead>
                                <TableHead>Nuværende pris</TableHead>
                                <TableHead>Beregnet pris</TableHead>
                                <TableHead>Stripe Price ID</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {packages
                                .filter(p => p.data.kunde_type === 'sæson' && p.data.pakke_kategori === 'startpakke')
                                .sort((a, b) => a.data.enheder - b.data.enheder)
                                .map((pkg) => {
                                  const calculatedPrice = getCalculatedPrice(pkg);
                                  const hasDiscrepancy = hasPriceDiscrepancy(pkg);
                                  return (
                                    <TableRow key={pkg.id}>
                                      <TableCell className="font-medium">{pkg.data.navn}</TableCell>
                                      <TableCell>{pkg.data.enheder}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className={hasDiscrepancy ? "text-orange-500 font-medium" : ""}>
                                            {(pkg.data.pris_dkk || 0).toFixed(2)} kr
                                          </span>
                                          {hasDiscrepancy && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">{calculatedPrice.toFixed(2)} kr</TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {pkg.data.stripe_price_id || <span className="text-muted-foreground">-</span>}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" onClick={() => handleEditPrice(pkg)}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => { setPackageToDelete(pkg); setShowDeleteDialog(true); }}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Sæson Tillægspakker */}
                    {packages.filter(p => p.data.kunde_type === 'sæson' && p.data.pakke_kategori === 'tillæg').length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 px-2">Sæson Tillægspakker</h3>
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Pakke navn</TableHead>
                                <TableHead>Enheder</TableHead>
                                <TableHead>Nuværende pris</TableHead>
                                <TableHead>Beregnet pris</TableHead>
                                <TableHead>Stripe Price ID</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {packages
                                .filter(p => p.data.kunde_type === 'sæson' && p.data.pakke_kategori === 'tillæg')
                                .sort((a, b) => a.data.enheder - b.data.enheder)
                                .map((pkg) => {
                                  const calculatedPrice = getCalculatedPrice(pkg);
                                  const hasDiscrepancy = hasPriceDiscrepancy(pkg);
                                  return (
                                    <TableRow key={pkg.id}>
                                      <TableCell className="font-medium">{pkg.data.navn}</TableCell>
                                      <TableCell>{pkg.data.enheder}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className={hasDiscrepancy ? "text-orange-500 font-medium" : ""}>
                                            {(pkg.data.pris_dkk || 0).toFixed(2)} kr
                                          </span>
                                          {hasDiscrepancy && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">{calculatedPrice.toFixed(2)} kr</TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {pkg.data.stripe_price_id || <span className="text-muted-foreground">-</span>}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" onClick={() => handleEditPrice(pkg)}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => { setPackageToDelete(pkg); setShowDeleteDialog(true); }}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Legend */}
                <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span>Afviger fra beregnet pris</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {/* Edit Price Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Rediger pris</DialogTitle>
            <DialogDescription>
              Opdater prisen for {editingPackage?.data.navn}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Ny pris (kr)</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.1"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            {editingPackage && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p>
                  <strong>Enheder:</strong> {editingPackage.data.enheder}
                </p>
                <p>
                  <strong>Beregnet pris:</strong>{" "}
                  {(editingPackage.data.enheder * basisPris).toFixed(2)} kr
                </p>
                <p>
                  <strong>Nuværende pris:</strong> {(editingPackage.data.pris_dkk || 0).toFixed(2)} kr
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleSavePrice}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Recalculate Confirmation */}
      <AlertDialog open={showBulkRecalcDialog} onOpenChange={setShowBulkRecalcDialog}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Genberegn alle priser?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil opdatere alle pakkepriser baseret på den nuværende basis pris ({basisPris} kr)
              og antallet af enheder. Alle manuelle prisændringer vil blive overskrevet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkRecalculate}>
              Genberegn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Package Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Opret ny pakke</DialogTitle>
            <DialogDescription>
              Opret en ny strømpakke. Prisen beregnes automatisk baseret på basis pris.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="package-name">Pakke navn</Label>
              <Input
                id="package-name"
                placeholder="F.eks. 10 enheder (1 dag)"
                value={newPackageName}
                onChange={(e) => setNewPackageName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="package-units">Antal enheder</Label>
              <Input
                id="package-units"
                type="number"
                step="1"
                placeholder="F.eks. 10"
                value={newPackageUnits}
                onChange={(e) => setNewPackageUnits(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-type">Kunde type</Label>
              <Select value={newPackageCustomerType} onValueChange={(value) => {
                setNewPackageCustomerType(value);
                // Reset package type when customer type changes
                setNewPackageType(value === "sæson" ? "startpakke" : "dagspakke");
              }}>
                <SelectTrigger id="customer-type">
                  <SelectValue placeholder="Vælg kunde type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="sæson">Sæson</SelectItem>
                  <SelectItem value="kørende">Kørende</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="package-type">Pakke type</Label>
              <Select value={newPackageType} onValueChange={setNewPackageType}>
                <SelectTrigger id="package-type">
                  <SelectValue placeholder="Vælg pakke type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {newPackageCustomerType === "sæson" ? (
                    <>
                      <SelectItem value="startpakke">Startpakke</SelectItem>
                      <SelectItem value="tillæg">Tillægspakke</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="dagspakke">Dagspakke</SelectItem>
                      <SelectItem value="tillæg">Tillægspakke</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {newPackageUnits && !isNaN(parseFloat(newPackageUnits)) && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p>
                  <strong>Beregnet pris:</strong>{" "}
                  {(parseFloat(newPackageUnits) * basisPris).toFixed(2)} kr
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleCreatePackage}>Opret pakke</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Package Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Slet pakke?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette pakken "{packageToDelete?.data.navn}"?
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePackage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Slet pakke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default AdminPriser;
