import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { formatDanishDate } from "@/utils/dateTime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import TableSkeleton from "@/components/shared/TableSkeleton";
import EmptyState from "@/components/shared/EmptyState";
import { useDebounce } from "@/hooks/useDebounce";
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
import {
  Search,
  MoreVertical,
  Package,
  Gift,
  Move,
  LogOut,
  Eye,
  Save,
  Mail,
  Plus,
  Trash2,
  Zap,
  Activity,
  Power,
} from "lucide-react";

interface Customer {
  id: string;
  data: {
    booking_nummer: string;
    navn: string;
    email?: string;
    phone?: string;
    fornavn?: string;
    efternavn?: string;
    check_in: string;
    check_out: string;
    kunde_type: string;
    status: string;
    maaler_navn?: string;
    meter_start_energy?: number;
    meter_start_time?: string;
    aktiv_pakke?: string;
    spot_number?: string;
    license_plates?: string[];
    number_of_persons?: number;
  };
}

interface AdminKunderProps {
  isStaffView?: boolean;
}

const AdminKunder = ({ isStaffView = false }: AdminKunderProps = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [kundeTypeFilter, setKundeTypeFilter] = useState("all");

  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignPackageModal, setShowAssignPackageModal] = useState(false);
  const [showFreePackageModal, setShowFreePackageModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // Email form
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Selected customer and data
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [availableMeters, setAvailableMeters] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [freePackageReason, setFreePackageReason] = useState("");
  const [selectedMeter, setSelectedMeter] = useState<string>("");
  const [meterSearchTerm, setMeterSearchTerm] = useState("");
  const [meterReadings, setMeterReadings] = useState<Record<string, { power: number; state: string }>>({});
  
  // Ekstra målere
  const [showAddExtraMeterModal, setShowAddExtraMeterModal] = useState(false);
  const [extraMeters, setExtraMeters] = useState<any[]>([]);
  const [extraMeterReadings, setExtraMeterReadings] = useState<Record<string, any>>({});
  const [selectedExtraMeter, setSelectedExtraMeter] = useState<string>("");
  const [addingExtraMeter, setAddingExtraMeter] = useState(false);
  const [togglingExtraMeter, setTogglingExtraMeter] = useState<string | null>(null);
  const [togglingPrimaryMeter, setTogglingPrimaryMeter] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchPackages();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, debouncedSearchTerm, kundeTypeFilter]);

  // Check for booking parameter and open customer modal
  useEffect(() => {
    const bookingParam = searchParams.get('booking');
    
    if (bookingParam && customers.length > 0) {
      // Convert booking param to string for comparison
      const customer = customers.find(c => c.data.booking_nummer?.toString() === bookingParam);
      
      if (customer) {
        // Use the same function as clicking on a customer in the list
        handleViewDetails(customer);
        // Remove the parameter after opening
        setTimeout(() => setSearchParams({}), 100);
      }
    }
  }, [searchParams, customers]);

  const fetchCustomers = async () => {
    try {
      // Hent sæson kunder (checked in)
      const { data: seasonalData, error: seasonalError } = await (supabase as any)
        .from("seasonal_customers")
        .select("*")
        .eq("checked_in", true)
        .order("created_at", { ascending: false });

      if (seasonalError) throw seasonalError;

      // Hent kørende campister (checked in)
      const { data: regularData, error: regularError } = await (supabase as any)
        .from("regular_customers")
        .select("*")
        .eq("checked_in", true)
        .order("created_at", { ascending: false });

      if (regularError) throw regularError;

      // Konverter til Customer format - meter_id er allerede meter navn

      const allCustomers = [
        ...(seasonalData || []).map((customer: any) => ({
          id: customer.id,
          ref_id: customer.booking_id.toString(),
          data: {
            booking_nummer: customer.booking_id,
            navn: `${customer.first_name} ${customer.last_name}`,
            fornavn: customer.first_name,
            efternavn: customer.last_name,
            email: customer.email || "",
            phone: customer.phone || "",
            check_in: customer.arrival_date,
            check_out: customer.departure_date,
            kunde_type: customer.customer_type || "sæson",
            status: customer.checked_in ? "aktiv" : "kommende",
            maaler_navn: customer.meter_id || null,
            meter_start_energy: customer.meter_start_energy || null,
            meter_start_time: customer.meter_start_time || null,
            aktiv_pakke: customer.has_power_package ? customer.power_package_type : null,
            spot_number: customer.spot_number,
            license_plates: customer.license_plates,
          },
          created_at: customer.created_at,
        })),
        ...(regularData || []).map((customer: any) => ({
          id: customer.id,
          ref_id: customer.booking_id.toString(),
          data: {
            booking_nummer: customer.booking_id,
            navn: `${customer.first_name} ${customer.last_name}`,
            fornavn: customer.first_name,
            efternavn: customer.last_name,
            email: customer.email || "",
            phone: customer.phone || "",
            check_in: customer.arrival_date,
            check_out: customer.departure_date,
            kunde_type: "kørende",
            status: customer.checked_in ? "aktiv" : "kommende",
            maaler_navn: customer.meter_id || null,
            meter_start_energy: customer.meter_start_energy || null,
            meter_start_time: customer.meter_start_time || null,
            aktiv_pakke: null,
            spot_number: customer.spot_number,
            license_plates: customer.license_plates,
            number_of_persons: customer.number_of_persons,
          },
          created_at: customer.created_at,
        })),
      ];

      setCustomers(allCustomers);
      
      // Hent effekt-data for alle målere
      await fetchMeterReadings();
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Fejl ved hentning af kunder");
    } finally {
      setLoading(false);
    }
  };

  const fetchMeterReadings = async () => {
    try {
      // Hent seneste readings for alle målere
      const { data, error } = await (supabase as any)
        .from("meter_readings")
        .select("meter_id, power, state, time")
        .order("time", { ascending: false });

      if (error) throw error;

      // Byg et map med seneste reading per måler
      const readingsMap: Record<string, { power: number; state: string }> = {};
      for (const reading of data || []) {
        if (!readingsMap[reading.meter_id]) {
          readingsMap[reading.meter_id] = {
            power: reading.power || 0,
            state: reading.state || "OFF"
          };
        }
      }
      setMeterReadings(readingsMap);
    } catch (error) {
      console.error("Error fetching meter readings:", error);
    }
  };

  // Opdater effekt-data hvert 30. sekund
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMeterReadings();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPackages = async (customerType?: string, bookingNumber?: string | number, departureDate?: string, includeFreePackages: boolean = false) => {
    try {
      let query = (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakke_typer");
      
      // For gratis pakker: hent alle (inkl. inaktive), ellers kun aktive
      if (!includeFreePackages) {
        query = query.filter("data->>aktiv", "eq", "true");
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Filtrer pakker baseret på kunde type og aktive pakker
      let filteredPackages = data || [];
      
      if (customerType && bookingNumber) {
        // Tjek om kunden har en aktiv hovedpakke
        // Hent ALLE pakker (aktiv, udløbet, opbrugt) så admin kan se historik
        const { data: activePakker } = await (supabase as any)
          .from("plugin_data")
          .select("*")
          .eq("module", "pakker")
          .filter("data->>booking_nummer", "eq", bookingNumber.toString());
        
        const hasActiveHovedpakke = activePakker?.some((pkg: any) => {
          const pakkeNavn = pkg.data.pakke_navn?.toLowerCase() || '';
          // Hovedpakker indeholder "dag" eller "dage" i navnet
          return pakkeNavn.includes('dag');
        });
        
        // Beregn dage til udtjekning for kørende kunder
        let daysUntilCheckout = null;
        if (customerType === 'kørende' && departureDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const checkout = new Date(departureDate);
          checkout.setHours(0, 0, 0, 0);
          daysUntilCheckout = Math.ceil((checkout.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        if (customerType === 'kørende') {
          if (hasActiveHovedpakke) {
            // Har aktiv dagspakke: Vis tillægspakker + mulighed for flere dage
            filteredPackages = filteredPackages.filter((pkg: any) => {
              if (pkg.data.pakke_kategori === 'tillæg') {
                return true; // Vis alle tillægspakker
              }
              if (pkg.data.pakke_kategori === 'dagspakke') {
                // Filtrer dagspakker baseret på dage til udtjekning
                if (daysUntilCheckout !== null) {
                  const pakkeNavn = pkg.data.navn?.toLowerCase() || '';
                  const dagMatch = pakkeNavn.match(/(\d+)\s*dag/);
                  if (dagMatch) {
                    const pakkeDage = parseInt(dagMatch[1]);
                    return pakkeDage <= daysUntilCheckout;
                  }
                }
                return true; // Hvis vi ikke kan parse, vis pakken
              }
              return false;
            });
          } else {
            // Ingen aktiv dagspakke: Vis kun dagspakker der passer til ophold
            filteredPackages = filteredPackages.filter((pkg: any) => {
              if (pkg.data.pakke_kategori !== 'dagspakke') return false;
              
              // Filtrer baseret på dage til udtjekning
              if (daysUntilCheckout !== null) {
                const pakkeNavn = pkg.data.navn?.toLowerCase() || '';
                const dagMatch = pakkeNavn.match(/(\d+)\s*dag/);
                if (dagMatch) {
                  const pakkeDage = parseInt(dagMatch[1]);
                  return pakkeDage <= daysUntilCheckout;
                }
              }
              return true; // Hvis vi ikke kan parse, vis pakken
            });
          }
        } else if (customerType === 'sæson') {
          // Tjek om sæson kunde har nogen aktiv pakke
          const hasAnyActivePakke = activePakker && activePakker.length > 0;
          
          if (hasAnyActivePakke) {
            // Har aktiv pakke: Vis kun tillægspakker
            filteredPackages = filteredPackages.filter((pkg: any) => 
              pkg.data.pakke_kategori === 'tillæg'
            );
          } else {
            // Ingen aktiv pakke: Vis kun startpakke (100 enheder sæson)
            filteredPackages = filteredPackages.filter((pkg: any) => 
              pkg.data.pakke_kategori === 'startpakke' && 
              pkg.data.navn?.toLowerCase().includes('sæson')
            );
          }
        }
      }
      
      setAvailablePackages(filteredPackages);
    } catch (error) {
      console.error("Error fetching packages:", error);
    }
  };

  const fetchAvailableMeters = async () => {
    try {
      // Get ALL meters from power_meters table
      const { data: allMeters, error: metersError } = await (supabase as any)
        .from("power_meters")
        .select("id, meter_number");

      if (metersError) throw metersError;

      // Get all assigned meters from seasonal_customers
      const { data: seasonalData } = await (supabase as any)
        .from("seasonal_customers")
        .select("meter_id")
        .not("meter_id", "is", null);

      // Get all assigned meters from regular_customers
      const { data: regularData } = await (supabase as any)
        .from("regular_customers")
        .select("meter_id")
        .not("meter_id", "is", null);

      // Get all extra meters (ekstra målere tilknyttet bookinger)
      const { data: extraMeters } = await (supabase as any)
        .from("booking_extra_meters")
        .select("meter_id");

      // Get all assigned meter IDs (inkluderer både primære og ekstra målere)
      const assignedMeterIds = new Set([
        ...(seasonalData?.map((c: any) => c.meter_id) || []),
        ...(regularData?.map((c: any) => c.meter_id) || []),
        ...(extraMeters?.map((m: any) => m.meter_id) || []),
      ]);

      // Filter out assigned meters - use is_online from power_meters (Z2M availability)
      const availableMetersWithStatus = (allMeters || [])
        .filter((meter: any) => !assignedMeterIds.has(meter.meter_number))
        .map((meter: any) => ({
          id: meter.meter_number,
          meter_id: meter.meter_number,
          is_online: meter.is_online ?? true,
        }));

      setAvailableMeters(availableMetersWithStatus);
    } catch (error) {
      console.error("Error fetching meters:", error);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    if (kundeTypeFilter !== "all") {
      filtered = filtered.filter((c) => c.data.kunde_type === kundeTypeFilter);
    }

    if (debouncedSearchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.data.booking_nummer?.toString().toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          c.data.navn?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          c.data.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }

    setFilteredCustomers(filtered);
  };

  const fetchCustomerDetails = async (customer: Customer) => {
    try {
      // Fetch all packages for this customer
      const { data: packages } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakker")
        .filter("data->>booking_nummer", "eq", customer.data.booking_nummer)
        .order("created_at", { ascending: false });

      // Fetch payment history
      const { data: payments } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "betalinger")
        .filter("data->>booking_nummer", "eq", customer.data.booking_nummer)
        .order("created_at", { ascending: false });

      // Fetch meter reading if customer has a meter
      let meterReading = null;
      if (customer.data.maaler_navn) {
        const { data: reading } = await (supabase as any)
          .from("meter_readings")
          .select("*")
          .eq("meter_id", customer.data.maaler_navn)
          .order("time", { ascending: false })
          .limit(1)
          .single();
        
        meterReading = reading;
      }

      // Bestem booking type baseret på kunde_type
      const bookingType = customer.data.kunde_type === "sæson" ? "seasonal" : "regular";
      
      // Hent ekstra målere
      const { data: extraMetersData } = await (supabase as any)
        .from("booking_extra_meters")
        .select("*")
        .eq("booking_id", customer.id)
        .eq("booking_type", bookingType);
      
      setExtraMeters(extraMetersData || []);
      
      // Hent meter readings for ekstra målere
      const extraReadings: Record<string, any> = {};
      for (const extraMeter of extraMetersData || []) {
        const { data: reading } = await (supabase as any)
          .from("meter_readings")
          .select("*")
          .eq("meter_id", extraMeter.meter_id)
          .order("time", { ascending: false })
          .limit(1)
          .single();
        
        if (reading) {
          extraReadings[extraMeter.meter_id] = reading;
        }
      }
      setExtraMeterReadings(extraReadings);

      setCustomerDetails({
        packages: packages || [],
        payments: payments || [],
        meterReading: meterReading,
      });
    } catch (error) {
      console.error("Error fetching customer details:", error);
      toast.error("Fejl ved hentning af kunde detaljer");
    }
  };

  const handleViewDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    await fetchCustomerDetails(customer);
    setShowDetailsModal(true);
  };

  // Tilføj ekstra måler til booking
  const handleAddExtraMeter = async () => {
    if (!selectedCustomer || !selectedExtraMeter) {
      toast.error("Vælg en måler");
      return;
    }

    setAddingExtraMeter(true);
    try {
      const bookingType = selectedCustomer.data.kunde_type === "sæson" ? "seasonal" : "regular";
      
      // Hent nuværende målerstand
      const { data: meterReading } = await (supabase as any)
        .from("meter_readings")
        .select("energy")
        .eq("meter_id", selectedExtraMeter)
        .order("time", { ascending: false })
        .limit(1)
        .single();

      // Indsæt ekstra måler
      const { error } = await (supabase as any)
        .from("booking_extra_meters")
        .insert({
          booking_type: bookingType,
          booking_id: selectedCustomer.id,
          meter_id: selectedExtraMeter,
          meter_start_energy: meterReading?.energy || 0,
          meter_start_time: new Date().toISOString(),
        });

      if (error) throw error;

      // Sæt current_customer_id på power_meters så auto-sluk ikke slukker den
      await (supabase as any)
        .from("power_meters")
        .update({ current_customer_id: selectedCustomer.id })
        .eq("meter_number", selectedExtraMeter);

      toast.success(`Måler ${selectedExtraMeter} tilføjet`);
      setShowAddExtraMeterModal(false);
      setSelectedExtraMeter("");
      
      // Opdater kunde detaljer
      await fetchCustomerDetails(selectedCustomer);
    } catch (error: any) {
      console.error("Error adding extra meter:", error);
      if (error.code === '23505') {
        toast.error("Denne måler er allerede tilføjet til bookingen");
      } else {
        toast.error("Fejl ved tilføjelse af måler");
      }
    } finally {
      setAddingExtraMeter(false);
    }
  };

  // Fjern ekstra måler fra booking
  const handleRemoveExtraMeter = async (extraMeterId: string) => {
    if (!selectedCustomer) return;
    
    try {
      // Hent meter_id først så vi kan frigive den
      const { data: extraMeter } = await (supabase as any)
        .from("booking_extra_meters")
        .select("meter_id")
        .eq("id", extraMeterId)
        .single();

      const { error } = await (supabase as any)
        .from("booking_extra_meters")
        .delete()
        .eq("id", extraMeterId);

      if (error) throw error;

      // Fjern current_customer_id fra power_meters og sluk måler
      if (extraMeter?.meter_id) {
        await (supabase as any)
          .from("power_meters")
          .update({ current_customer_id: null })
          .eq("meter_number", extraMeter.meter_id);
        
        // Sluk måleren
        await (supabase as any)
          .from("meter_commands")
          .insert({
            meter_id: extraMeter.meter_id,
            command: "set_state",
            value: "OFF",
            status: "pending"
          });
      }

      toast.success("Måler fjernet og slukket");
      
      // Opdater kunde detaljer
      await fetchCustomerDetails(selectedCustomer);
    } catch (error) {
      console.error("Error removing extra meter:", error);
      toast.error("Fejl ved fjernelse af måler");
    }
  };

  // Toggle ekstra måler strøm
  const handleToggleExtraMeter = async (meterId: string, turnOn: boolean) => {
    if (!selectedCustomer) return;
    
    setTogglingExtraMeter(meterId);
    try {
      const newState = turnOn ? 'ON' : 'OFF';
      
      // Direkte insert i meter_commands (command-processor håndterer MQTT)
      const { error } = await supabase
        .from('meter_commands')
        .insert({
          meter_id: meterId,
          command: 'set_state',
          value: newState,
          status: 'pending'
        });

      if (error) throw error;

      // Opdater lokalt
      setExtraMeterReadings(prev => ({
        ...prev,
        [meterId]: {
          ...prev[meterId],
          state: newState
        }
      }));

      toast.success(`Måler ${meterId} ${turnOn ? 'tændes' : 'slukkes'}...`);
    } catch (error: any) {
      console.error("Error toggling extra meter:", error);
      toast.error(error.message || "Fejl ved ændring af strøm");
    } finally {
      setTogglingExtraMeter(null);
    }
  };

  // Toggle primær måler strøm
  const handleTogglePrimaryMeter = async (turnOn: boolean) => {
    if (!selectedCustomer?.data.maaler_navn) return;
    
    setTogglingPrimaryMeter(true);
    try {
      const newState = turnOn ? 'ON' : 'OFF';
      
      // Direkte insert i meter_commands
      const { error } = await supabase
        .from('meter_commands')
        .insert({
          meter_id: selectedCustomer.data.maaler_navn,
          command: 'set_state',
          value: newState,
          status: 'pending'
        });

      if (error) throw error;

      toast.success(`Måler ${selectedCustomer.data.maaler_navn} ${turnOn ? 'tændes' : 'slukkes'}...`);
      
      // Opdater lokal state efter kort delay
      setTimeout(() => fetchCustomerDetails(selectedCustomer), 1000);
    } catch (error: any) {
      console.error("Error toggling primary meter:", error);
      toast.error(error.message || "Fejl ved ændring af strøm");
    } finally {
      setTogglingPrimaryMeter(false);
    }
  };

  const handleAssignPackage = async () => {
    if (!selectedCustomer || !selectedPackage) {
      toast.error("Vælg en pakke");
      return;
    }

    try {
      const packageType = availablePackages.find((p) => p.id === selectedPackage);
      if (!packageType) return;

      // Hent aktuel målerstand hvis kunden har en måler
      let currentEnergy = null;
      if (selectedCustomer.data.maaler_navn) {
        const { data: meterData } = await (supabase as any)
          .from("meter_readings")
          .select("energy")
          .eq("meter_id", selectedCustomer.data.maaler_navn)
          .order("time", { ascending: false })
          .limit(1)
          .single();
        
        currentEnergy = meterData?.energy || null;
      }

      // Create active package
      const { error } = await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "pakker",
          ref_id: crypto.randomUUID(),
          key: `pakke_${selectedCustomer.data.booking_nummer}_${Date.now()}`,
          data: {
            booking_nummer: selectedCustomer.data.booking_nummer,
            type_id: packageType.ref_id,
            pakke_navn: packageType.data.navn,
            pakke_kategori: packageType.data.pakke_kategori,
            enheder: packageType.data.enheder,
            pakke_start_energy: currentEnergy,
            status: "aktiv",
            betaling_metode: "reception",
            kunde_type: (selectedCustomer as any).customer_type || 'kørende',
          },
        });

      if (error) throw error;

      // Opdater daily_package_stats med salg - brug direkte SQL
      const today = new Date().toISOString().split('T')[0];
      const kwhSold = parseFloat(packageType.data.enheder);
      const revenue = parseFloat(packageType.data.pris_dkk || packageType.data.pris || 0);
      
      // Bestem kunde type baseret på tabel
      const kundeType = (selectedCustomer as any).customer_type || 'kørende';
      
      // Først tjek om række findes
      const { data: existing } = await (supabase as any)
        .from('daily_package_stats')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('date', today)
        .eq('kunde_type', kundeType)
        .eq('betalings_metode', 'reception')
        .maybeSingle();
      
      if (existing) {
        // UPDATE - increment værdier
        await (supabase as any)
          .from('daily_package_stats')
          .update({
            packages_sold: existing.packages_sold + 1,
            kwh_sold: parseFloat(existing.kwh_sold) + kwhSold,
            revenue: parseFloat(existing.revenue) + revenue,
            updated_at: new Date().toISOString()
          })
          .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
          .eq('date', today)
          .eq('kunde_type', kundeType)
          .eq('betalings_metode', 'reception');
      } else {
        // INSERT - ny række
        await (supabase as any)
          .from('daily_package_stats')
          .insert({
            organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            date: today,
            kunde_type: kundeType,
            betalings_metode: 'reception',
            packages_sold: 1,
            kwh_sold: kwhSold,
            revenue: revenue,
            updated_at: new Date().toISOString()
          });
      }

      // Pakke tildelt - kunden kan selv tænde måleren fra kunde-siden
      toast.success("Pakke tildelt - kunden kan nu tænde måleren");
      setShowAssignPackageModal(false);
      setSelectedPackage("");
      fetchCustomers();
    } catch (error) {
      console.error("Error assigning package:", error);
      toast.error("Fejl ved tildeling af pakke");
    }
  };

  const handleAssignFreePackage = async () => {
    if (!selectedCustomer || !selectedPackage || !freePackageReason.trim()) {
      toast.error("Vælg pakke og indtast årsag");
      return;
    }

    try {
      const packageType = availablePackages.find((p) => p.id === selectedPackage);
      if (!packageType) return;

      // Check 1000 unit limit for free packages
      if (packageType.data.enheder > 1000) {
        toast.error("Gratis pakker må maks være 1000 enheder");
        return;
      }

      // Hent aktuel målerstand hvis kunden har en måler
      let currentEnergy = null;
      if (selectedCustomer.data.maaler_navn) {
        const { data: meterData } = await (supabase as any)
          .from("meter_readings")
          .select("energy")
          .eq("meter_id", selectedCustomer.data.maaler_navn)
          .order("time", { ascending: false })
          .limit(1)
          .single();
        
        currentEnergy = meterData?.energy || null;
      }

      // Create free package
      const { error: packageError } = await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "pakker",
          ref_id: crypto.randomUUID(),
          key: `pakke_gratis_${selectedCustomer.data.booking_nummer}_${Date.now()}`,
          data: {
            booking_nummer: selectedCustomer.data.booking_nummer,
            type_id: packageType.ref_id,
            pakke_navn: packageType.data.navn,
            pakke_kategori: packageType.data.pakke_kategori,
            enheder: packageType.data.enheder,
            pakke_start_energy: currentEnergy,
            status: "aktiv",
            betaling_metode: "gratis",
            kunde_type: selectedCustomer.data.kunde_type,
          },
        });

      if (packageError) throw packageError;

      // Log to audit log
      const logId = crypto.randomUUID();
      const { error: logError } = await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "audit_log",
          ref_id: logId,
          key: `audit_free_package_${selectedCustomer.data.booking_nummer}_${Date.now()}`,
          data: {
            action: "assign_free_package",
            booking_nummer: selectedCustomer.data.booking_nummer,
            pakke_navn: packageType.data.navn,
            reason: freePackageReason,
            timestamp: new Date().toISOString(),
          },
        });

      if (logError) throw logError;

      // Opdater daily_package_stats med gratis pakke - brug direkte SQL
      const today = new Date().toISOString().split('T')[0];
      const kwhSold = parseFloat(packageType.data.enheder);
      
      // Bestem kunde type
      const kundeType = (selectedCustomer as any).customer_type || 'kørende';
      
      // Først tjek om række findes
      const { data: existing } = await (supabase as any)
        .from('daily_package_stats')
        .select('*')
        .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('date', today)
        .eq('kunde_type', kundeType)
        .eq('betalings_metode', 'gratis')
        .maybeSingle();
      
      if (existing) {
        // UPDATE - increment værdier
        await (supabase as any)
          .from('daily_package_stats')
          .update({
            packages_sold: existing.packages_sold + 1,
            kwh_sold: parseFloat(existing.kwh_sold) + kwhSold,
            updated_at: new Date().toISOString()
          })
          .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
          .eq('date', today)
          .eq('kunde_type', kundeType)
          .eq('betalings_metode', 'gratis');
      } else {
        // INSERT - ny række
        await (supabase as any)
          .from('daily_package_stats')
          .insert({
            organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            date: today,
            kunde_type: kundeType,
            betalings_metode: 'gratis',
            packages_sold: 1,
            kwh_sold: kwhSold,
            revenue: 0,
            updated_at: new Date().toISOString()
          });
      }

      // Pakke tildelt - kunden kan selv tænde måleren fra kunde-siden
      toast.success("Gratis pakke tildelt og logget - kunden kan nu tænde måleren");
      setShowFreePackageModal(false);
      setSelectedPackage("");
      setFreePackageReason("");
      fetchCustomers();
    } catch (error) {
      console.error("Error assigning free package:", error);
      toast.error("Fejl ved tildeling af gratis pakke");
    }
  };

  const handleMoveMeter = async () => {
    if (!selectedCustomer || !selectedMeter) {
      toast.error("Vælg en måler");
      return;
    }

    try {
      const oldMeterNumber = selectedCustomer.data.maaler_navn;
      const newMeterNumber = selectedMeter;

      // KRITISK: Tjek om det er SAMME måler - undgå at nulstille forbrug
      if (oldMeterNumber === newMeterNumber) {
        toast.info("Kunden har allerede denne måler tildelt");
        setShowMoveModal(false);
        return;
      }

      // Validate new meter exists by meter_number
      const { data: newMeterData } = await (supabase as any)
        .from("power_meters")
        .select("meter_number")
        .eq("meter_number", newMeterNumber)
        .single();

      if (!newMeterData) {
        toast.error("Måler ikke fundet");
        return;
      }

      // VALIDATION: Check if meter is already assigned to another customer
      // Check direct meter_number assignments
      const { data: seasonalCheck } = await (supabase as any)
        .from("seasonal_customers")
        .select("booking_id, first_name, last_name, meter_id")
        .eq("checked_in", true)
        .neq("booking_id", selectedCustomer.data.booking_nummer);

      const { data: regularCheck } = await (supabase as any)
        .from("regular_customers")
        .select("booking_id, first_name, last_name, meter_id")
        .eq("checked_in", true)
        .neq("booking_id", selectedCustomer.data.booking_nummer);

      // Check if any customer has this meter (direct text)
      const allCustomers = [...(seasonalCheck || []), ...(regularCheck || [])];
      const conflictCustomer = allCustomers.find(c => 
        c.meter_id === newMeterNumber
      );

      if (conflictCustomer) {
        toast.error(
          `Måler ${newMeterNumber} er allerede tildelt kunde ${conflictCustomer.booking_id} (${conflictCustomer.first_name} ${conflictCustomer.last_name})`
        );
        return;
      }

      // Get current energy reading from NEW meter
      const { data: newMeterReading } = await (supabase as any)
        .from("meter_readings")
        .select("energy, time")
        .eq("meter_id", newMeterNumber)
        .order("time", { ascending: false })
        .limit(1)
        .single();

      const newMeterEnergy = newMeterReading?.energy || 0;
      const newMeterTime = newMeterReading?.time || new Date().toISOString();

      // Get OLD meter's last reading to calculate accumulated usage
      let accumulatedUsage = 0;
      if (oldMeterNumber) {
        const { data: oldMeterReading } = await (supabase as any)
          .from("meter_readings")
          .select("energy")
          .eq("meter_id", oldMeterNumber)
          .order("time", { ascending: false })
          .limit(1)
          .single();

        const oldMeterEnergy = oldMeterReading?.energy || 0;

        // Get customer's meter_start_energy to calculate usage on old meter
        const tableName = selectedCustomer.data.kunde_type === "sæson" 
          ? "seasonal_customers" 
          : "regular_customers";

        const { data: customerData } = await (supabase as any)
          .from(tableName)
          .select("meter_start_energy")
          .eq("booking_id", selectedCustomer.data.booking_nummer)
          .single();

        const oldMeterStartEnergy = customerData?.meter_start_energy || 0;
        accumulatedUsage = Math.max(0, oldMeterEnergy - oldMeterStartEnergy);
      }

      // Update customer table with new meter_id and start reading
      const tableName = selectedCustomer.data.kunde_type === "sæson" 
        ? "seasonal_customers" 
        : "regular_customers";

      // If moving from old meter, we need to free it first
      if (oldMeterNumber) {
        // Find and free the old meter by removing meter_id from any other customer that might have it
        // (This shouldn't happen, but just to be safe)
        const otherTableName = selectedCustomer.data.kunde_type === "sæson" 
          ? "regular_customers" 
          : "seasonal_customers";
        
        await (supabase as any)
          .from(otherTableName)
          .update({ 
            meter_id: null,
            meter_start_energy: null,
            meter_start_time: null,
            updated_at: new Date().toISOString() 
          })
          .eq("meter_id", oldMeterNumber)
          .neq("booking_id", selectedCustomer.data.booking_nummer);
      }

      const updateData: any = {
        meter_id: newMeterNumber,
        meter_start_energy: newMeterEnergy,
        meter_start_time: newMeterTime,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await (supabase as any)
        .from(tableName)
        .update(updateData)
        .eq("booking_id", selectedCustomer.data.booking_nummer);

      if (updateError) throw updateError;

      // Get customer UUID for power_meters update
      const { data: customerData } = await (supabase as any)
        .from(tableName)
        .select('id')
        .eq("booking_id", selectedCustomer.data.booking_nummer)
        .single();

      if (!customerData) throw new Error("Customer not found");

      // Lock new meter FIRST
      await (supabase as any)
        .from("power_meters")
        .update({
          is_available: false,
          current_customer_id: customerData.id,
          updated_at: new Date().toISOString()
        })
        .eq("meter_number", newMeterNumber);

      // Update pakke_start_energy for all active packages BEFORE freeing old meter
      const { data: activePakker } = await (supabase as any)
        .from("plugin_data")
        .select("id, data")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakker")
        .filter("data->>booking_nummer", "eq", selectedCustomer.data.booking_nummer)
        .filter("data->>status", "eq", "aktiv");

      if (activePakker && activePakker.length > 0) {
        for (const pakke of activePakker) {
          // Update accumulated_usage with usage from old meter
          // Then set pakke_start_energy to new meter's current reading
          const currentAccumulated = parseFloat(pakke.data.accumulated_usage || '0');
          const newAccumulated = currentAccumulated + accumulatedUsage;
          
          await (supabase as any)
            .from("plugin_data")
            .update({
              data: {
                ...pakke.data,
                pakke_start_energy: newMeterEnergy,
                accumulated_usage: newAccumulated.toFixed(2)
              }
            })
            .eq("id", pakke.id);
        }
      }

      // Free old meter LAST and turn it OFF
      if (oldMeterNumber) {
        // Free the meter in database FIRST by meter_number
        await (supabase as any)
          .from("power_meters")
          .update({
            is_available: true,
            current_customer_id: null,
            updated_at: new Date().toISOString()
          })
          .eq("meter_number", oldMeterNumber);

        // Then turn OFF old meter to prevent unpaid usage
        // Insert command into meter_commands table (same as Dashboard and MaalerDetaljer)
        await (supabase as any)
          .from('meter_commands')
          .insert({
            meter_id: oldMeterNumber,
            command: 'set_state',
            value: 'OFF',
            status: 'pending'
          });
      }

      // Get current user role for audit log
      const { data: { user } } = await supabase.auth.getUser();
      let userRole = "unknown";
      if (user) {
        const { data: membershipData } = await (supabase as any)
          .from("user_memberships")
          .select("role_id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (membershipData) {
          const { data: roleData } = await (supabase as any)
            .from("roles")
            .select("name")
            .eq("id", membershipData.role_id)
            .single();
          
          if (roleData) {
            userRole = roleData.name === "admin" || roleData.name === "superadmin" ? "admin" : "staff";
          }
        }
      }

      // Log action
      const logId = crypto.randomUUID();
      await (supabase as any)
        .from("plugin_data")
        .insert({
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          module: "audit_log",
          ref_id: logId,
          key: `meter_${oldMeterNumber ? 'move' : 'assign'}_${selectedCustomer.data.booking_nummer}_${Date.now()}`,
          data: {
            action: oldMeterNumber ? "move_meter" : "assign_meter",
            booking_nummer: selectedCustomer.data.booking_nummer,
            from_meter: oldMeterNumber,
            to_meter: newMeterNumber,
            start_energy: newMeterEnergy,
            start_time: newMeterTime,
            accumulated_usage: accumulatedUsage,
            performed_by: userRole,
            timestamp: new Date().toISOString(),
          },
        });

      toast.success(
        oldMeterNumber 
          ? `Kunde flyttet til ny måler - Akkumuleret forbrug: ${accumulatedUsage.toFixed(2)} kWh` 
          : `Måler tildelt - Start aflæsning: ${newMeterEnergy.toFixed(2)} kWh`
      );
      setShowMoveModal(false);
      setSelectedMeter("");
      setMeterSearchTerm("");
      fetchCustomers();
    } catch (error) {
      console.error("Error moving meter:", error);
      toast.error("Fejl ved flytning af måler");
    }
  };

  const handleSendEmail = async () => {
    if (!selectedCustomer?.data.email) {
      toast.error("Kunden har ingen email adresse");
      return;
    }

    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Udfyld venligst emne og besked");
      return;
    }

    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: selectedCustomer.data.email,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, '<br>'),
          from_name: 'Jelling Camping',
          from_email: 'peter@jellingcamping.dk',
          reply_to: 'peter@jellingcamping.dk'
        }
      });

      if (error) throw error;

      toast.success(`Email sendt til ${selectedCustomer.data.email}`);
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Fejl ved afsendelse af email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedCustomer) return;

    try {
      const tableName = selectedCustomer.data.kunde_type === "sæson" 
        ? "seasonal_customers" 
        : "regular_customers";
      
      const bookingId = selectedCustomer.data.booking_nummer;

      // Get customer data to find meter_id
      const { data: customerData } = await (supabase as any)
        .from(tableName)
        .select('meter_id, id')
        .eq('booking_id', bookingId)
        .single();

      if (!customerData) {
        toast.error("Kunde ikke fundet");
        return;
      }

      // Free meter in power_meters if assigned
      if (customerData.meter_id) {
        // Free meter by meter_number only
        await (supabase as any)
          .from("power_meters")
          .update({
            is_available: true,
            current_customer_id: null,
            updated_at: new Date().toISOString()
          })
          .eq("meter_number", customerData.meter_id);
      }

      // Delete customer packages (GDPR)
      await (supabase as any)
        .from("plugin_data")
        .delete()
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakker")
        .eq("data->>booking_nummer", bookingId.toString());

      // Delete customer from database (GDPR)
      await (supabase as any)
        .from(tableName)
        .delete()
        .eq('booking_id', bookingId);

      // Delete approved plates
      await (supabase as any)
        .from("approved_plates")
        .delete()
        .eq('booking_id', bookingId);

      toast.success("Kunde tjekket ud og data slettet (GDPR)");
      setShowCheckoutDialog(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error("Error during checkout:", error);
      toast.error("Fejl ved checkout");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      aktiv: { label: "Aktiv", variant: "default" },
      checked_out: { label: "Checked out", variant: "secondary" },
    };

    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          {isStaffView ? <StaffSidebar /> : <AdminSidebar />}
          <div className="flex-1 flex flex-col">
            <header className="h-16 border-b bg-background flex items-center px-4 sm:px-6">
              <SidebarTrigger />
              <h1 className="text-xl sm:text-2xl font-bold ml-4">Kunder</h1>
            </header>
            <main className="flex-1 p-4 sm:p-6 bg-muted/20">
              <Card>
                <CardHeader>
                  <CardTitle>Kunde oversigt</CardTitle>
                  <CardDescription>Indlæser kundedata...</CardDescription>
                </CardHeader>
                <CardContent>
                  <TableSkeleton rows={10} columns={9} />
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {isStaffView ? <StaffSidebar /> : <AdminSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-background flex items-center px-4 sm:px-6">
            <SidebarTrigger />
            <h1 className="text-xl sm:text-2xl font-bold ml-4">Kunder</h1>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Kunde oversigt</CardTitle>
                <CardDescription>Administrer alle bookinger og kunder</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Søg efter booking nr., navn eller email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11"
                        aria-label="Søg efter kunder"
                      />
                    </div>
                  </div>
                  <Select value={kundeTypeFilter} onValueChange={setKundeTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] h-11">
                      <SelectValue placeholder="Kunde type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="all">Alle typer</SelectItem>
                      <SelectItem value="sæson">Sæson kunder</SelectItem>
                      <SelectItem value="kørende">Kørende campister</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Table - Responsive with horizontal scroll on mobile */}
                <div className="border rounded-lg overflow-x-auto">
                  {filteredCustomers.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title="Ingen kunder fundet"
                      description={
                        debouncedSearchTerm || kundeTypeFilter !== "all"
                          ? "Prøv at justere dine søgekriterier"
                          : "Der er ingen aktive kunder i systemet endnu"
                      }
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[100px]">Booking nr.</TableHead>
                          <TableHead className="min-w-[150px]">Navn</TableHead>
                          <TableHead className="min-w-[200px]">Email</TableHead>
                          <TableHead className="min-w-[180px]">Check-in/out</TableHead>
                          <TableHead className="min-w-[120px]">Kunde type</TableHead>
                          <TableHead className="min-w-[100px]">Måler</TableHead>
                          <TableHead className="min-w-[100px]">Effekt</TableHead>
                          <TableHead className="min-w-[120px]">Aktiv pakke</TableHead>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="w-12">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.map((customer) => (
                          <TableRow
                            key={customer.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleViewDetails(customer)}
                          >
                            <TableCell className="font-medium">
                              {customer.data.booking_nummer}
                            </TableCell>
                            <TableCell>{customer.data.navn}</TableCell>
                            <TableCell className="text-sm">{customer.data.email || "-"}</TableCell>
                            <TableCell className="text-sm">
                              {formatDanishDate(customer.data.check_in)} -{" "}
                              {formatDanishDate(customer.data.check_out)}
                            </TableCell>
                            <TableCell className="capitalize">
                              {customer.data.kunde_type}
                            </TableCell>
                            <TableCell>{customer.data.maaler_navn || "-"}</TableCell>
                            <TableCell>
                              {customer.data.maaler_navn && meterReadings[customer.data.maaler_navn] ? (
                                <span className={`font-medium ${
                                  meterReadings[customer.data.maaler_navn].power > 0 
                                    ? "text-green-600" 
                                    : "text-muted-foreground"
                                }`}>
                                  {(meterReadings[customer.data.maaler_navn].power ?? 0).toFixed(0)} W
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{customer.data.aktiv_pakke || "-"}</TableCell>
                            <TableCell>{getStatusBadge(customer.data.status)}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-10 w-10"
                                    aria-label="Åbn handlinger"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-background z-50">
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      setSelectedCustomer(customer);
                                      await fetchPackages(customer.data.kunde_type, customer.data.booking_nummer, customer.data.check_out);
                                      setShowAssignPackageModal(true);
                                    }}
                                  >
                                    <Package className="mr-2 h-4 w-4" />
                                    Tildel pakke
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      setSelectedCustomer(customer);
                                      await fetchPackages(customer.data.kunde_type, customer.data.booking_nummer, customer.data.check_out);
                                      setShowFreePackageModal(true);
                                    }}
                                  >
                                    <Gift className="mr-2 h-4 w-4" />
                                    Tildel gratis pakke
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      setSelectedCustomer(customer);
                                      await fetchAvailableMeters();
                                      setShowMoveModal(true);
                                    }}
                                  >
                                    <Move className="mr-2 h-4 w-4" />
                                    Flyt til anden måler
                                  </DropdownMenuItem>
                                  {!isStaffView && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedCustomer(customer);
                                        setShowCheckoutDialog(true);
                                      }}
                                      className="text-destructive"
                                    >
                                      <LogOut className="mr-2 h-4 w-4" />
                                      Manuel checkout
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {/* Customer Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-background max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedCustomer?.data.maaler_navn || `Booking ${selectedCustomer?.data.booking_nummer}`}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer?.data.navn}
            </DialogDescription>
          </DialogHeader>
          {customerDetails && (
            <div className="space-y-8 py-4">
              {/* Kunde Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Kunde Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Booking nummer</p>
                    <p className="font-medium">{selectedCustomer?.data.booking_nummer}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Navn</p>
                    <p className="font-medium">{selectedCustomer?.data.navn}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedCustomer?.data.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Telefon</p>
                    <p className="font-medium">{selectedCustomer?.data.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kunde type</p>
                    <p className="font-medium capitalize">{selectedCustomer?.data.kunde_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{selectedCustomer?.data.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ankomst</p>
                    <p className="font-medium">{selectedCustomer?.data.check_in ? formatDanishDate(selectedCustomer.data.check_in) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Afrejse</p>
                    <p className="font-medium">{selectedCustomer?.data.check_out ? formatDanishDate(selectedCustomer.data.check_out) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Plads nummer</p>
                    <p className="font-medium">{selectedCustomer?.data.spot_number || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Måler</p>
                    <p className="font-medium">{selectedCustomer?.data.maaler_navn || "Ikke tildelt"}</p>
                    {selectedCustomer?.data.meter_start_energy !== null && selectedCustomer?.data.meter_start_energy !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Start aflæsning: {selectedCustomer.data.meter_start_energy.toFixed(2)} kWh
                        {selectedCustomer.data.meter_start_time && (
                          <span className="ml-2">({formatDanishDate(selectedCustomer.data.meter_start_time)})</span>
                        )}
                      </p>
                    )}
                  </div>
                  {selectedCustomer?.data.license_plates && selectedCustomer.data.license_plates.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Nummerplader</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedCustomer.data.license_plates.map((plate: string, idx: number) => (
                          <Badge key={idx} variant="outline">{plate}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedCustomer?.data.number_of_persons && (
                    <div>
                      <p className="text-sm text-muted-foreground">Antal personer</p>
                      <p className="font-medium">{selectedCustomer.data.number_of_persons}</p>
                    </div>
                  )}
                </div>
                </CardContent>
              </Card>

              {/* Meter Status */}
              {customerDetails.meterReading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <Card className="text-center">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Badge variant={customerDetails.meterReading.state === "ON" ? "default" : "secondary"} className="text-lg px-4 py-1">
                        {customerDetails.meterReading.state}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Sidst set: {new Date(customerDetails.meterReading.time).toLocaleString('da-DK', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="text-center">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Effekt</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="text-3xl font-bold">{(customerDetails.meterReading.power ?? 0).toFixed(1)} W</div>
                      <p className="text-sm text-muted-foreground">
                        {(customerDetails.meterReading.current ?? 0).toFixed(2)} A
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="text-center">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Spænding</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{(customerDetails.meterReading.voltage ?? 0).toFixed(0)} V</div>
                    </CardContent>
                  </Card>

                  <Card className="text-center">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Energi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-3xl font-bold">{(customerDetails.meterReading.energy ?? 0).toFixed(2)} kWh</div>
                      <Badge variant={(customerDetails.meterReading.linkquality ?? 0) > 80 ? "default" : "destructive"}>
                        Signal: {customerDetails.meterReading.linkquality ?? 0}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Ekstra Målere */}
              {!isStaffView && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Tilknyttede Målere
                    </CardTitle>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        fetchAvailableMeters();
                        setShowAddExtraMeterModal(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Tilføj måler
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Primær måler */}
                      {selectedCustomer?.data.maaler_navn && customerDetails?.meterReading && (
                        <div className="p-4 border rounded-lg bg-primary/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Primær</Badge>
                              <span className="font-medium">{selectedCustomer.data.maaler_navn}</span>
                            </div>
                            <Badge variant={customerDetails.meterReading.state === "ON" ? "default" : "secondary"}>
                              {customerDetails.meterReading.state}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Aktuelt forbrug</p>
                              <p className="font-bold text-lg flex items-center gap-1">
                                <Activity className="h-4 w-4" />
                                {(customerDetails.meterReading.power ?? 0).toFixed(0)} W
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Forbrug siden start</p>
                              <p className="font-medium">
                                {((customerDetails.meterReading.energy ?? 0) - (selectedCustomer.data.meter_start_energy ?? 0)).toFixed(2)} kWh
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Spænding</p>
                              <p className="font-medium">{(customerDetails.meterReading.voltage ?? 0).toFixed(0)} V</p>
                            </div>
                          </div>
                          {/* Tænd/Sluk knapper for primær måler */}
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <Button
                              size="sm"
                              variant={customerDetails.meterReading.state === "ON" ? "outline" : "default"}
                              onClick={() => handleTogglePrimaryMeter(true)}
                              disabled={togglingPrimaryMeter || customerDetails.meterReading.state === "ON"}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              Tænd
                            </Button>
                            <Button
                              size="sm"
                              variant={customerDetails.meterReading.state !== "ON" ? "outline" : "destructive"}
                              onClick={() => handleTogglePrimaryMeter(false)}
                              disabled={togglingPrimaryMeter || customerDetails.meterReading.state !== "ON"}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              Sluk
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Ekstra målere */}
                      {extraMeters.length > 0 && (
                        <>
                          {extraMeters.map((extra) => {
                            const reading = extraMeterReadings[extra.meter_id];
                            return (
                              <div key={extra.id} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">Ekstra</Badge>
                                    <span className="font-medium">{extra.meter_id}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {reading && (
                                      <Badge variant={reading.state === "ON" ? "default" : "secondary"}>
                                        {reading.state}
                                      </Badge>
                                    )}
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => handleRemoveExtraMeter(extra.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {reading ? (
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Aktuelt forbrug</p>
                                      <p className="font-bold text-lg flex items-center gap-1">
                                        <Activity className="h-4 w-4" />
                                        {(reading.power ?? 0).toFixed(0)} W
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Forbrug siden start</p>
                                      <p className="font-medium">
                                        {((reading.energy ?? 0) - (extra.meter_start_energy ?? 0)).toFixed(2)} kWh
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Spænding</p>
                                      <p className="font-medium">{(reading.voltage ?? 0).toFixed(0)} V</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Ingen data tilgængelig</p>
                                )}
                                {/* Tænd/Sluk knapper */}
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    variant={reading?.state === "ON" ? "outline" : "default"}
                                    onClick={() => handleToggleExtraMeter(extra.meter_id, true)}
                                    disabled={togglingExtraMeter === extra.meter_id || reading?.state === "ON"}
                                  >
                                    <Power className="h-4 w-4 mr-1" />
                                    Tænd
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={reading?.state !== "ON" ? "outline" : "destructive"}
                                    onClick={() => handleToggleExtraMeter(extra.meter_id, false)}
                                    disabled={togglingExtraMeter === extra.meter_id || reading?.state !== "ON"}
                                  >
                                    <Power className="h-4 w-4 mr-1" />
                                    Sluk
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Tilføjet: {new Date(extra.added_at).toLocaleString('da-DK')}
                                </p>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Samlet forbrug hvis der er ekstra målere */}
                      {extraMeters.length > 0 && customerDetails?.meterReading && (
                        <div className="p-4 border-2 border-primary rounded-lg bg-primary/10">
                          <h4 className="font-semibold mb-2">Samlet forbrug (alle målere)</h4>
                          {(() => {
                            const primaryUsage = (customerDetails.meterReading.energy ?? 0) - (selectedCustomer?.data.meter_start_energy ?? 0);
                            const extraUsage = extraMeters.reduce((sum, extra) => {
                              const reading = extraMeterReadings[extra.meter_id];
                              if (reading) {
                                return sum + ((reading.energy ?? 0) - (extra.meter_start_energy ?? 0));
                              }
                              return sum;
                            }, 0);
                            const totalUsage = primaryUsage + extraUsage;
                            const totalPower = (customerDetails.meterReading.power ?? 0) + 
                              extraMeters.reduce((sum, extra) => sum + (extraMeterReadings[extra.meter_id]?.power ?? 0), 0);
                            
                            return (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-muted-foreground text-sm">Samlet aktuelt</p>
                                  <p className="text-2xl font-bold">{totalPower.toFixed(0)} W</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-sm">Samlet forbrug siden start</p>
                                  <p className="text-2xl font-bold">{totalUsage.toFixed(2)} kWh</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {!selectedCustomer?.data.maaler_navn && extraMeters.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Ingen målere tilknyttet denne booking
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Packages */}
              <div>
                <h3 className="font-semibold mb-4">Pakker</h3>
                {customerDetails.packages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen pakker</p>
                ) : (
                  <>
                    {(() => {
                      // Brug ALLE pakker (aktiv, udløbet, opbrugt) så admin kan se historik
                      const allePakker = customerDetails.packages;
                      const activePakker = allePakker.filter((p: any) => p.data.status === 'aktiv');
                      
                      if (activePakker.length === 0 || !customerDetails.meterReading) {
                        // Find dagspakke for at tjekke udløb
                        const dagspakke = customerDetails.packages.find((p: any) => 
                          p.data.varighed_timer !== null && p.data.varighed_timer !== undefined
                        );
                        
                        return (
                          <div className="space-y-2">
                            {customerDetails.packages.map((pkg: any) => {
                              // Tjek om dette er en tillægspakke og om dagspakken er udløbet
                              const isDagspakke = pkg.data.varighed_timer !== null && pkg.data.varighed_timer !== undefined;
                              const dagspakkeExpired = dagspakke && dagspakke.data.varighed_timer && 
                                new Date().getTime() > new Date(dagspakke.created_at).getTime() + dagspakke.data.varighed_timer * 60 * 60 * 1000;
                              const isTillægInactive = !isDagspakke && dagspakkeExpired;
                              
                              // Vis som inaktiv hvis tillægspakke og dagspakke er udløbet
                              const displayStatus = isTillægInactive ? "inaktiv" : pkg.data.status;
                              
                              return (
                              <div key={pkg.id} className="p-3 border rounded-lg text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{pkg.data.pakke_navn}</span>
                                  <Badge variant={displayStatus === "aktiv" ? "default" : "secondary"}>
                                    {displayStatus}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground mt-1">
                                  {pkg.data.enheder} enheder - {pkg.data.betaling_metode}
                                </p>
                                {pkg.created_at && pkg.data.varighed_timer && pkg.data.status === 'aktiv' && (() => {
                                  const expiryDate = new Date(new Date(pkg.created_at).getTime() + pkg.data.varighed_timer * 60 * 60 * 1000);
                                  const now = new Date();
                                  const hoursLeft = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
                                  const minutesLeft = Math.max(0, Math.floor(((expiryDate.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60)));
                                  
                                  return (
                                    <p className={`text-sm mt-1 ${hoursLeft < 2 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                      Udløber: {expiryDate.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' })}, {expiryDate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                                      {hoursLeft < 24 && ` (${hoursLeft}t ${minutesLeft}m)`}
                                    </p>
                                  );
                                })()}
                              </div>
                              );
                            })}
                          </div>
                        );
                      }

                      // Beregn total forbrug med accumulated_usage fra ALLE pakker
                      const accumulated = activePakker.reduce((sum: number, p: any) => 
                        sum + parseFloat(p.data?.accumulated_usage || '0'), 0);
                      // Option D: Brug pakke_start_energy KUN hvis > 0, ellers meter_start_energy
                      const pakkeStartRaw = activePakker[0]?.data?.pakke_start_energy;
                      const pakkeStart = (pakkeStartRaw !== null && pakkeStartRaw !== undefined && pakkeStartRaw > 0)
                        ? pakkeStartRaw
                        : parseFloat(selectedCustomer?.data.meter_start_energy || '0');
                      const currentMeterUsage = customerDetails.meterReading ? Math.max(0, customerDetails.meterReading.energy - pakkeStart) : 0;
                      const totalActualUsage = accumulated + currentMeterUsage;
                      
                      // Distribute usage: dagspakke first, then tillæg in order
                      let remainingUsage = totalActualUsage;
                      const pakkeUsages = new Map();
                      
                      // Sort ALLE pakker: dagspakke first, then tillæg by creation date
                      const sortedAllePakker = [...allePakker].sort((a: any, b: any) => {
                        const aIsDags = a.data.varighed_timer !== null && a.data.varighed_timer !== undefined;
                        const bIsDags = b.data.varighed_timer !== null && b.data.varighed_timer !== undefined;
                        if (aIsDags && !bIsDags) return -1;
                        if (!aIsDags && bIsDags) return 1;
                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                      });
                      
                      // Brug kun aktive pakker til forbrug beregning
                      sortedAllePakker.filter((p: any) => p.data.status === 'aktiv').forEach((p: any) => {
                        const pakkeEnheder = parseFloat(p.data.enheder);
                        const usedFromThisPakke = Math.min(remainingUsage, pakkeEnheder);
                        pakkeUsages.set(p.id, usedFromThisPakke);
                        remainingUsage = Math.max(0, remainingUsage - usedFromThisPakke);
                      });
                      
                      const totalUsage = totalActualUsage;
                      const totalEnheder = activePakker.reduce((sum: number, p: any) => sum + parseFloat(p.data.enheder), 0);
                      const totalRemaining = totalEnheder - totalUsage;
                      const totalPercentUsed = totalEnheder > 0 ? (totalUsage / totalEnheder) * 100 : 0;

                      return (
                        <>
                          {/* Total oversigt */}
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

                          {/* Individuelle pakker */}
                          <div className="space-y-3">
                            {sortedAllePakker.map((pkg: any) => {
                              const usage = pakkeUsages.get(pkg.id) || 0;
                              const remaining = pkg.data.enheder - usage;
                              const percentUsed = (usage / pkg.data.enheder) * 100;
                              
                              // Find dagspakke for at tjekke udløb
                              const dagspakke = sortedAllePakker.find((p: any) => 
                                p.data.varighed_timer !== null && p.data.varighed_timer !== undefined
                              );
                              
                              // Tjek om dette er en tillægspakke og om dagspakken er udløbet
                              const isDagspakke = pkg.data.varighed_timer !== null && pkg.data.varighed_timer !== undefined;
                              const dagspakkeExpired = dagspakke && dagspakke.data.varighed_timer && 
                                new Date().getTime() > new Date(dagspakke.created_at).getTime() + dagspakke.data.varighed_timer * 60 * 60 * 1000;
                              const isTillægInactive = !isDagspakke && dagspakkeExpired;
                              
                              // Vis som inaktiv hvis tillægspakke og dagspakke er udløbet
                              const displayStatus = isTillægInactive ? "inaktiv" : pkg.data.status;

                              return (
                                <div key={pkg.id} className="bg-muted/50 rounded-lg p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">{pkg.data.pakke_navn}</p>
                                        <Badge variant={displayStatus === 'aktiv' ? 'default' : 'secondary'}>
                                          {displayStatus}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {pkg.data.betaling_metode}
                                      </p>
                                      {pkg.created_at && pkg.data.varighed_timer && pkg.data.status === 'aktiv' && (() => {
                                        const expiryDate = new Date(new Date(pkg.created_at).getTime() + pkg.data.varighed_timer * 60 * 60 * 1000);
                                        const now = new Date();
                                        const hoursLeft = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
                                        const minutesLeft = Math.max(0, Math.floor(((expiryDate.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60)));
                                        
                                        return (
                                          <p className={`text-sm mt-1 ${hoursLeft < 2 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                            Udløber: {expiryDate.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' })}, {expiryDate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                                            {hoursLeft < 24 && ` (${hoursLeft}t ${minutesLeft}m)`}
                                          </p>
                                        );
                                      })()}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium">
                                        {usage.toFixed(2)} / {pkg.data.enheder} kWh
                                      </p>
                                      <p className={`text-sm ${remaining <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                        {remaining > 0 ? `${remaining.toFixed(2)} kWh tilbage` : 'Opbrugt'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="w-full bg-secondary rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all ${
                                        percentUsed >= 100 ? 'bg-destructive' : 
                                        percentUsed >= 90 ? 'bg-yellow-500' : 
                                        'bg-primary'
                                      }`}
                                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Payment History */}
              <div>
                <h3 className="font-semibold mb-2">Betalingshistorik</h3>
                {customerDetails.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen betalinger</p>
                ) : (
                  <div className="space-y-2">
                    {customerDetails.payments.map((payment: any) => (
                      <div key={payment.id} className="p-3 border rounded-lg text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{payment.data.beloeb} kr</span>
                          <span className="text-muted-foreground">
                            {formatDanishDate(payment.created_at)}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                          Metode: {payment.data.metode || "N/A"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <div className="flex flex-wrap gap-2 flex-1">
                {!selectedCustomer?.data.maaler_navn ? (
                  <Button 
                    onClick={() => {
                      fetchAvailableMeters();
                      setShowDetailsModal(false);
                      setShowMoveModal(true);
                    }}
                    className="min-h-[44px]"
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Tildel måler
                  </Button>
                ) : (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      fetchAvailableMeters();
                      setShowDetailsModal(false);
                      setShowMoveModal(true);
                    }}
                    className="min-h-[44px]"
                  >
                    <Move className="mr-2 h-4 w-4" />
                    Skift måler
                  </Button>
                )}
                <Button 
                  onClick={async () => {
                    if (selectedCustomer) {
                      await fetchPackages(selectedCustomer.data.kunde_type, selectedCustomer.data.booking_nummer, selectedCustomer.data.check_out);
                    }
                    setShowDetailsModal(false);
                    setShowAssignPackageModal(true);
                  }}
                  className="min-h-[44px]"
                >
                  <Package className="mr-2 h-4 w-4" />
                  Tildel pakke
                </Button>
                <Button 
                  variant="outline"
                  onClick={async () => {
                    if (selectedCustomer) {
                      await fetchPackages(selectedCustomer.data.kunde_type, selectedCustomer.data.booking_nummer, selectedCustomer.data.check_out, true);
                    }
                    setShowDetailsModal(false);
                    setShowFreePackageModal(true);
                  }}
                  className="min-h-[44px]"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  Gratis pakke
                </Button>
                {selectedCustomer?.data.email && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowDetailsModal(false);
                      setShowEmailModal(true);
                    }}
                    className="min-h-[44px]"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                )}
              </div>
              <Button 
                variant="secondary" 
                onClick={() => setShowDetailsModal(false)}
                className="min-h-[44px]"
              >
                Luk
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Package Modal */}
      <Dialog open={showAssignPackageModal} onOpenChange={setShowAssignPackageModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Tildel pakke</DialogTitle>
            <DialogDescription>
              Vælg en pakke til {selectedCustomer?.data.navn}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vælg pakke</Label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg pakke" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availablePackages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.data.navn} - {pkg.data.enheder} enheder - {pkg.data.pris_dkk} kr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignPackageModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleAssignPackage}>Tildel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free Package Modal */}
      <Dialog open={showFreePackageModal} onOpenChange={setShowFreePackageModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Tildel gratis pakke</DialogTitle>
            <DialogDescription>
              Gratis pakker må maks være 1000 enheder og kræver en begrundelse
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vælg pakke</Label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg pakke" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availablePackages
                    .filter((pkg) => pkg.data.enheder <= 1000)
                    .map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.data.pakke_navn} - {pkg.data.enheder} enheder
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Begrundelse (påkrævet)</Label>
              <Textarea
                id="reason"
                placeholder="Indtast årsag til gratis pakke..."
                value={freePackageReason}
                onChange={(e) => setFreePackageReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFreePackageModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleAssignFreePackage}>Tildel gratis</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Meter Modal */}
      <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer?.data.maaler_navn ? "Flyt til anden måler" : "Tildel måler"}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer?.data.maaler_navn 
                ? `Nuværende måler: ${selectedCustomer.data.maaler_navn}` 
                : "Vælg en ledig måler til kunden"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vælg {selectedCustomer?.data.maaler_navn ? "ny" : ""} måler</Label>
              <Input
                placeholder="Søg efter måler ID..."
                value={meterSearchTerm}
                onChange={(e) => setMeterSearchTerm(e.target.value)}
                className="mb-2"
              />
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {availableMeters
                  .filter((meter) =>
                    meter.meter_id.toLowerCase().includes(meterSearchTerm.toLowerCase())
                  )
                  .slice(0, 50)
                  .map((meter: any) => (
                    <div
                      key={meter.id}
                      onClick={() => {
                        setSelectedMeter(meter.id);
                        setMeterSearchTerm(meter.meter_id);
                      }}
                      className={`p-3 cursor-pointer hover:bg-accent ${
                        selectedMeter === meter.id ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{meter.meter_id}</span>
                        {!meter.is_online && (
                          <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                            ⚠️ Offline
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                {availableMeters.filter((meter) =>
                  meter.meter_id.toLowerCase().includes(meterSearchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="p-3 text-center text-muted-foreground">
                    Ingen målere fundet
                  </div>
                )}
              </div>
              {selectedMeter && (
                <p className="text-sm text-muted-foreground mt-2">
                  Valgt: <strong>{availableMeters.find(m => m.id === selectedMeter)?.meter_id}</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleMoveMeter}>
              {selectedCustomer?.data.maaler_navn ? "Flyt måler" : "Tildel måler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Confirmation */}
      <AlertDialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Manuel checkout</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil udføre følgende handlinger:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Slette alle pakker</li>
                <li>Frigøre måleren</li>
                <li>Sætte booking status til "checked_out"</li>
              </ul>
              <p className="mt-2 font-medium">Er du sikker?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckout}>
              Udfør checkout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Send Email til {selectedCustomer?.data.navn}</DialogTitle>
            <DialogDescription>
              Email sendes til: {selectedCustomer?.data.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-subject">Emne</Label>
              <Input
                id="email-subject"
                placeholder="Email emne..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-body">Besked</Label>
              <Textarea
                id="email-body"
                placeholder="Skriv din besked her..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>
              Annuller
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? "Sender..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Extra Meter Modal */}
      <Dialog open={showAddExtraMeterModal} onOpenChange={setShowAddExtraMeterModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Tilføj ekstra måler</DialogTitle>
            <DialogDescription>
              Tilføj en ekstra måler til {selectedCustomer?.data.navn}. 
              Måleren vil dele strømpakke med den primære måler.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Søg efter måler</Label>
              <Input
                placeholder="Søg efter måler ID..."
                value={meterSearchTerm}
                onChange={(e) => setMeterSearchTerm(e.target.value)}
                className="mb-2"
              />
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {availableMeters
                  .filter((meter) =>
                    meter.meter_id.toLowerCase().includes(meterSearchTerm.toLowerCase()) &&
                    meter.meter_id !== selectedCustomer?.data.maaler_navn &&
                    !extraMeters.some(em => em.meter_id === meter.meter_id)
                  )
                  .slice(0, 50)
                  .map((meter: any) => (
                    <div
                      key={meter.id}
                      onClick={() => {
                        setSelectedExtraMeter(meter.meter_id);
                        setMeterSearchTerm(meter.meter_id);
                      }}
                      className={`p-3 cursor-pointer hover:bg-accent ${
                        selectedExtraMeter === meter.meter_id ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{meter.meter_id}</span>
                        <div className="flex items-center gap-2">
                          {!meter.is_online && (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                              ⚠️ Offline
                            </span>
                          )}
                          {meter.current_customer_id && (
                            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-700 dark:text-red-400">
                              I brug
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                {availableMeters.filter((meter) =>
                  meter.meter_id.toLowerCase().includes(meterSearchTerm.toLowerCase()) &&
                  meter.meter_id !== selectedCustomer?.data.maaler_navn
                ).length === 0 && (
                  <div className="p-3 text-center text-muted-foreground">
                    Ingen målere fundet
                  </div>
                )}
              </div>
              {selectedExtraMeter && (
                <p className="text-sm text-muted-foreground mt-2">
                  Valgt måler: <strong>{selectedExtraMeter}</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddExtraMeterModal(false);
              setSelectedExtraMeter("");
              setMeterSearchTerm("");
            }}>
              Annuller
            </Button>
            <Button onClick={handleAddExtraMeter} disabled={addingExtraMeter || !selectedExtraMeter}>
              {addingExtraMeter ? "Tilføjer..." : "Tilføj måler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default AdminKunder;
