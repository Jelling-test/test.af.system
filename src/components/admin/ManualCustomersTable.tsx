import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { formatDanishDate } from "@/utils/dateTime";

interface ManualCustomer {
  id: string;
  plate_norm: string;
  name: string;
  category: string | null;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  created_at: string;
}

export function ManualCustomersTable() {
  const [customers, setCustomers] = useState<ManualCustomer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ManualCustomer | null>(null);
  const [formData, setFormData] = useState({
    plate_norm: "",
    name: "",
    category: "",
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: "",
    notes: "",
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .schema('manual')
      .from('customers')
      .select('*')
      .or(`valid_to.is.null,valid_to.gte.${nowIso}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      toast.error('Kunne ikke hente kunder');
    } else if (data) {
      setCustomers(data);
    }
  };

  const normalizePlate = (plate: string): string => {
    return plate.toUpperCase().replace(/[\s\.\-]/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalizedPlate = normalizePlate(formData.plate_norm);
    if (!normalizedPlate) {
      toast.error('Nummerplade er påkrævet');
      return;
    }

    if (!formData.name) {
      toast.error('Navn er påkrævet');
      return;
    }

    if (!formData.category) {
      toast.error('Kategori er påkrævet');
      return;
    }

    // Validate date range
    if (formData.valid_to && formData.valid_from) {
      const fromDate = new Date(formData.valid_from);
      const toDate = new Date(formData.valid_to);
      if (toDate < fromDate) {
        toast.error('Gyldig til skal være efter gyldig fra');
        return;
      }
    }

    try {
      const customerData: any = {
        plate_norm: normalizedPlate,
        name: formData.name,
        category: formData.category || null,
        valid_from: formData.valid_from || new Date().toISOString(),
        valid_to: formData.valid_to || null,
        notes: formData.notes || null,
      };

      if (editingCustomer) {
        const { error } = await (supabase as any)
          .schema('manual')
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);

        if (error) {
          const code = (error as any)?.code;
          const msg = (error as any)?.message || '';
          if (code === '23505' || code === '409' || /duplicate key value|already exists/i.test(msg)) {
            toast.error('Denne nummerplade findes allerede');
            return;
          }
          throw error;
        }
        toast.success('Kunde opdateret');
      } else {
        const { error } = await (supabase as any)
          .schema('manual')
          .from('customers')
          .insert(customerData);

        if (error) {
          const code = (error as any)?.code;
          const msg = (error as any)?.message || '';
          if (code === '23505' || code === '409' || /duplicate key value|already exists/i.test(msg)) {
            toast.error('Denne nummerplade findes allerede');
            return;
          }
          throw error;
        }
        toast.success('Kunde tilføjet');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Kunne ikke gemme kunde');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på, at du vil slette denne kunde?')) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .schema('manual')
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Kunde slettet');
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Kunne ikke slette kunde');
    }
  };

  const handleEdit = (customer: ManualCustomer) => {
    setEditingCustomer(customer);
    setFormData({
      plate_norm: customer.plate_norm,
      name: customer.name,
      category: customer.category || "",
      valid_from: customer.valid_from.split('T')[0],
      valid_to: customer.valid_to ? customer.valid_to.split('T')[0] : "",
      notes: customer.notes || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
      plate_norm: "",
      name: "",
      category: "",
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: "",
      notes: "",
    });
  };

  const formatDate = (date: string) => {
    try {
      return formatDanishDate(date);
    } catch {
      return date;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Manuelle kunder</h3>
          <p className="text-sm text-muted-foreground">
            Whitelist af nummerplader med permanent eller midlertidig adgang
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj kunde
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Rediger kunde' : 'Tilføj kunde'}
                </DialogTitle>
                <DialogDescription>
                  Indtast kundeoplysninger og nummerplade for adgang
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Navn *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plate">Nummerplade *</Label>
                  <Input
                    id="plate"
                    value={formData.plate_norm}
                    onChange={(e) => setFormData({ ...formData, plate_norm: e.target.value })}
                    placeholder="AB12345"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Mellemrum og specialtegn fjernes automatisk
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Kategori *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">Vælg kategori...</option>
                    <option value="Håndværker">Håndværker (07:00-21:00)</option>
                    <option value="Personale">Personale (24/7)</option>
                    <option value="Kørende">Kørende (07:00-23:00)</option>
                    <option value="Bude">Bude (07:00-17:00)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Vælg kategori - tidspunkterne vises kun som vejledning
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="valid_from">Gyldig fra</Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="valid_to">Gyldig til</Label>
                    <Input
                      id="valid_to"
                      type="date"
                      value={formData.valid_to}
                      onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Noter</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Eventuelle bemærkninger..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuller
                </Button>
                <Button type="submit">
                  {editingCustomer ? 'Gem ændringer' : 'Tilføj kunde'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nummerplade</TableHead>
              <TableHead>Navn</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Gyldig fra</TableHead>
              <TableHead>Gyldig til</TableHead>
              <TableHead className="text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Ingen kunder fundet
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-mono font-bold">
                    {customer.plate_norm}
                  </TableCell>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.category || '-'}</TableCell>
                  <TableCell>{formatDate(customer.valid_from)}</TableCell>
                  <TableCell>{customer.valid_to ? formatDate(customer.valid_to) : 'Ubegrænset'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
