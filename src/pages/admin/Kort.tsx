import React, { useEffect, useState, useRef, useCallback } from "react";
import { Stage, Layer, Circle, Text, Rect, RegularPolygon, Image as KonvaImage, Line } from "react-konva";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  Lock, 
  Unlock, 
  Zap, 
  ZapOff,
  Home,
  Radio,
  Printer,
  Settings,
  Upload,
  CalendarIcon,
  MapPin,
  Triangle,
  Save,
  CircuitBoard,
  Cable,
  Link2,
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

// ============ TYPER ============

interface Meter {
  id: string;
  meter_number: string;
  is_online: boolean;
  stand_id: string | null;
  map_x: number | null;
  map_y: number | null;
}

interface PowerStand {
  id: string;
  name: string;
  map_x: number | null;
  map_y: number | null;
  map_locked: boolean;
  meters: Meter[];
  fuse_group_id: string | null;
  fuse_group_name?: string;
  board_name?: string;
  board_id?: string;
}

interface MainBoard {
  id: string;
  name: string;
  location: string | null;
  map_x: number | null;
  map_y: number | null;
  map_locked: boolean;
}

interface DistributionBoard {
  id: string;
  name: string;
  board_number: number | null;
  main_board_id: string | null;
  map_x: number | null;
  map_y: number | null;
  map_locked: boolean;
  color: string;
}

interface FuseGroup {
  id: string;
  board_id: string;
  group_number: number;
  name: string | null;
  board_name?: string;
}

interface BoardConnection {
  id: string;
  from_board_id: string;
  to_board_id: string;
  connection_type: string;
  color: string;
}

interface Cabin {
  id: string;
  cabin_number: string;
  name: string;
  meter_id: string | null;
  is_active: boolean;
  map_x?: number | null;
  map_y?: number | null;
  map_locked?: boolean;
  distribution_board_id?: string | null;
}

interface Repeater {
  id: string;
  name: string;
  ieee_address: string | null;
  is_online: boolean;
  map_x: number | null;
  map_y: number | null;
  map_locked: boolean;
}

interface MapSpot {
  id: string;
  spot_number: string;
  spot_type: string;
  customer_type: string | null;
  winter_storage: boolean;
  map_x: number | null;
  map_y: number | null;
  map_locked: boolean;
}

interface Booking {
  id: string;
  spot_number: string;
  customer_type: "seasonal" | "regular";
  check_in: string;
  check_out: string;
}

interface MapConfig {
  id: string;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  settings: {
    standFontSize: number;
    spotFontSize: number;
    cabinFontSize: number;
    repeaterSize: number;
    standRadius: number;
    boardWidth: number;
    boardHeight: number;
  };
}

// ============ FARVE-KONSTANTER ============

const COLORS = {
  // Standere
  standAllOnline: "#22C55E",    // Grøn
  standPartialOffline: "#EAB308", // Gul
  standAllOffline: "#EF4444",   // Rød
  standNoMeters: "#9CA3AF",     // Grå
  
  // Hytter
  cabinOffline: "#EF4444",      // Rød
  cabinOnlineEmpty: "#000000",  // Sort
  cabinOnlineOccupied: "#22C55E", // Grøn
  
  // Repeatere
  repeaterOnline: "#3B82F6",    // Blå
  repeaterOffline: "#EF4444",   // Rød
  
  // Pladser
  spotAvailable: "#000000",     // Sort - ledig (nemmere at se på kort)
  spotSeasonal: "#EF4444",      // Rød - sæsongæst
  spotSeasonalWinter: "#9333EA", // Lilla - sæsongæst med vinteropbevaring
  spotRegular: "#3B82F6",       // Blå - kørende gæst
};

const DEFAULT_CONFIG: MapConfig = {
  id: "main",
  image_url: null,
  image_width: 1200,
  image_height: 800,
  settings: {
    standFontSize: 10,
    spotFontSize: 12,
    cabinFontSize: 14,
    repeaterSize: 15,
    standRadius: 25,
    boardWidth: 60,
    boardHeight: 35,
  },
};

// ============ HOVEDKOMPONENT ============

interface KortProps {
  isStaff?: boolean;
}

const Kort = ({ isStaff = false }: KortProps) => {
  const [stands, setStands] = useState<PowerStand[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [repeaters, setRepeaters] = useState<Repeater[]>([]);
  const [spots, setSpots] = useState<MapSpot[]>([]);
  const [unassignedMeters, setUnassignedMeters] = useState<Meter[]>([]);
  const [allMeters, setAllMeters] = useState<Meter[]>([]); // Alle målere til farve-lookup
  const [occupiedCabins, setOccupiedCabins] = useState<{ seasonal: Set<string>; regular: Set<string> }>({ seasonal: new Set(), regular: new Set() });
  const [mapConfig, setMapConfig] = useState<MapConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  
  // Canvas state
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  
  // Filtre
  const [showStands, setShowStands] = useState(true);
  const [showCabins, setShowCabins] = useState(true);
  const [showRepeaters, setShowRepeaters] = useState(true);
  const [showSpots, setShowSpots] = useState(true);
  const [showUnassigned, setShowUnassigned] = useState(true);
  
  // El-infrastruktur
  const [mainBoards, setMainBoards] = useState<MainBoard[]>([]);
  const [distributionBoards, setDistributionBoards] = useState<DistributionBoard[]>([]);
  const [fuseGroups, setFuseGroups] = useState<FuseGroup[]>([]);
  const [boardConnections, setBoardConnections] = useState<BoardConnection[]>([]);
  const [showBoards, setShowBoards] = useState(true);
  const [showMainBoards, setShowMainBoards] = useState(true);
  const [showConnections, setShowConnections] = useState(false);
  const [showBoardConnections, setShowBoardConnections] = useState(true);
  const [filterBoard, setFilterBoard] = useState<string>("all");
  const [filterFuseGroup, setFilterFuseGroup] = useState<string>("all");
  
  // Dato-filter
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Modal state
  const [selectedStand, setSelectedStand] = useState<PowerStand | null>(null);
  const [selectedCabin, setSelectedCabin] = useState<Cabin | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<MapSpot | null>(null);
  const [spotCustomer, setSpotCustomer] = useState<any>(null);
  const [cabinCustomer, setCabinCustomer] = useState<any>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  
  // Indstillinger
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState(DEFAULT_CONFIG.settings);
  
  // Blinkende animation for offline elementer
  const [blinkOn, setBlinkOn] = useState(true);
  
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkOn(prev => !prev);
    }, 600);
    return () => clearInterval(blinkInterval);
  }, []);
  
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    fetchData();
    
    const handleResize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Re-fetch når dato ændres
  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Hent standere
      const { data: standsData } = await (supabase as any)
        .from("power_stands")
        .select("*")
        .order("name");

      // Hent målere
      const { data: metersData } = await (supabase as any)
        .from("power_meters")
        .select("id, meter_number, is_online, stand_id, map_x, map_y")
        .order("meter_number");

      // Hent hytter
      const { data: cabinsData } = await (supabase as any)
        .from("cabins")
        .select("*")
        .eq("is_active", true)
        .order("cabin_number");

      // Hent repeatere (prøv - fejler stille hvis tabel ikke eksisterer)
      let repeatersData: Repeater[] = [];
      try {
        const { data } = await (supabase as any)
          .from("repeaters")
          .select("*")
          .order("name");
        repeatersData = data || [];
      } catch { /* tabel eksisterer måske ikke endnu */ }

      // Hent pladser
      let spotsData: MapSpot[] = [];
      try {
        const { data } = await (supabase as any)
          .from("map_spots")
          .select("*")
          .order("spot_number");
        spotsData = data || [];
      } catch { /* tabel kan være tom */ }

      // Hent el-infrastruktur
      const { data: mainBoardsData } = await (supabase as any)
        .from("main_boards")
        .select("*")
        .order("name");

      const { data: boardsData } = await (supabase as any)
        .from("distribution_boards")
        .select("*")
        .order("board_number");

      const { data: fuseGroupsData } = await (supabase as any)
        .from("fuse_groups")
        .select("*")
        .order("group_number");

      // Berig fuseGroups med board_name
      const boardsMap = new Map((boardsData || []).map((b: any) => [b.id, b]));
      const enrichedFuseGroups = (fuseGroupsData || []).map((fg: any) => {
        const board = boardsMap.get(fg.board_id);
        return {
          ...fg,
          board_name: board?.name || "Ukendt"
        };
      });

      // Hent tavle-forbindelser
      const { data: connectionsData } = await (supabase as any)
        .from("board_connections")
        .select("*");

      setMainBoards(mainBoardsData || []);
      setDistributionBoards(boardsData || []);
      setFuseGroups(enrichedFuseGroups);
      setBoardConnections(connectionsData || []);

      // Hent bookinger for valgt dato
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      // Sæsongæster: arrival_date <= selectedDate < departure_date (afrejsedag er ledig)
      const { data: seasonalData } = await (supabase as any)
        .from("seasonal_customers")
        .select("spot_number, spot_numbers, arrival_date, departure_date, winter_storage")
        .lte("arrival_date", dateStr)
        .gt("departure_date", dateStr);
      
      // Kørende gæster: arrival_date <= selectedDate < departure_date (afrejsedag er ledig)
      const { data: regularData } = await (supabase as any)
        .from("regular_customers")
        .select("spot_number, spot_numbers, arrival_date, departure_date, checked_in")
        .lte("arrival_date", dateStr)
        .gt("departure_date", dateStr);

      // Lav lookup for optagne pladser/hytter (bruges til både spots og cabins)
      // VIGTIGT: Brug spot_numbers array hvis tilgængeligt, ellers fallback til spot_number
      const seasonalSpots = new Set(
        (seasonalData || []).flatMap((s: any) => 
          s.spot_numbers && s.spot_numbers.length > 0 ? s.spot_numbers : [s.spot_number]
        ).filter(Boolean)
      );
      const regularSpots = new Set(
        (regularData || []).flatMap((r: any) => 
          r.spot_numbers && r.spot_numbers.length > 0 ? r.spot_numbers : [r.spot_number]
        ).filter(Boolean)
      );
      
      // Lookup for vinteropbevaring
      const winterStorageSpots = new Set(
        (seasonalData || [])
          .filter((s: any) => s.winter_storage)
          .flatMap((s: any) => 
            s.spot_numbers && s.spot_numbers.length > 0 ? s.spot_numbers : [s.spot_number]
          ).filter(Boolean)
      );
      
      // Gem i state til brug i getCabinColor
      setOccupiedCabins({ seasonal: seasonalSpots as Set<string>, regular: regularSpots as Set<string> });

      // Opdater spot customer_type baseret på bookinger
      spotsData = spotsData.map((spot) => ({
        ...spot,
        customer_type: seasonalSpots.has(spot.spot_number) 
          ? "seasonal" 
          : regularSpots.has(spot.spot_number) 
            ? "regular" 
            : null,
        winter_storage: winterStorageSpots.has(spot.spot_number),
      }));

      // Hent kort-config
      const { data: configData } = await (supabase as any)
        .from("map_config")
        .select("*")
        .eq("id", "main")
        .maybeSingle();

      // Lav Set af hytte-måler numre (skal ikke vises som ikke-tildelte)
      const cabinMeterNumbers = new Set(
        (cabinsData || [])
          .map((c: any) => c.meter_id)
          .filter((id: string | null) => id !== null)
      );

      // Gruppér målere efter stand_id, og identificer repeatere baseret på navn
      const metersByStand: Record<string, Meter[]> = {};
      const unassigned: Meter[] = [];
      const detectedRepeaters: Repeater[] = [];

      (metersData || []).forEach((meter: Meter) => {
        // Tjek om det er en repeater baseret på navnet
        const isRepeater = meter.meter_number.toLowerCase().includes("repeater");
        // Tjek om det er en hytte-måler
        const isCabinMeter = cabinMeterNumbers.has(meter.meter_number);
        
        if (isRepeater) {
          // Tilføj som repeater
          detectedRepeaters.push({
            id: meter.id,
            name: meter.meter_number,
            ieee_address: null,
            is_online: meter.is_online,
            map_x: meter.map_x,
            map_y: meter.map_y,
            map_locked: false,
          });
        } else if (isCabinMeter) {
          // Skip hytte-målere - de vises allerede som hytter
          return;
        } else if (meter.stand_id) {
          if (!metersByStand[meter.stand_id]) {
            metersByStand[meter.stand_id] = [];
          }
          metersByStand[meter.stand_id].push(meter);
        } else {
          unassigned.push(meter);
        }
      });

      // Tilføj målere og el-info til standere
      const fuseGroupMap = new Map(enrichedFuseGroups.map((fg: any) => [fg.id, fg]));
      const standsWithMeters = (standsData || []).map((stand: any) => {
        const fuseGroup = stand.fuse_group_id ? fuseGroupMap.get(stand.fuse_group_id) : null;
        return {
          ...stand,
          meters: metersByStand[stand.id] || [],
          fuse_group_name: fuseGroup ? `Gruppe ${fuseGroup.group_number}${fuseGroup.name ? ` (${fuseGroup.name})` : ""}` : null,
          board_name: fuseGroup?.board_name || null,
          board_id: fuseGroup?.board_id || null,
        };
      });

      setStands(standsWithMeters);
      setUnassignedMeters(unassigned);
      setAllMeters(metersData || []); // Gem alle målere til farve-lookup
      setCabins(cabinsData || []);
      // Kombiner repeatere fra database + auto-detekterede fra målere
      setRepeaters([...repeatersData, ...detectedRepeaters]);
      setSpots(spotsData);
      
      if (configData) {
        setMapConfig(configData);
        setTempSettings(configData.settings);
        // Load baggrundsbillede hvis det findes
        if (configData.image_url) {
          const img = new window.Image();
          img.crossOrigin = "anonymous"; // Tillader CORS for print-funktion
          img.src = configData.image_url;
          img.onload = () => setBackgroundImage(img);
        }
      }
    } catch (error) {
      console.error("Fejl ved hentning:", error);
      toast.error("Kunne ikke hente kort-data");
    } finally {
      setLoading(false);
    }
  };

  // ============ HJÆLPEFUNKTIONER ============

  const getStandColor = (stand: PowerStand): string => {
    if (stand.meters.length === 0) return COLORS.standNoMeters;
    const onlineCount = stand.meters.filter((m) => m.is_online).length;
    if (onlineCount === stand.meters.length) return COLORS.standAllOnline;
    if (onlineCount === 0) return COLORS.standAllOffline;
    return COLORS.standPartialOffline;
  };

  const hasOfflineMeters = (stand: PowerStand): boolean => {
    if (stand.meters.length === 0) return false;
    const onlineCount = stand.meters.filter((m) => m.is_online).length;
    return onlineCount < stand.meters.length;
  };

  const getCabinColor = (cabin: Cabin): string => {
    // Find måler for hytten fra alle målere
    const meter = allMeters.find((m) => m.meter_number === cabin.meter_id);
    
    if (!meter || !meter.is_online) return COLORS.cabinOffline;
    
    // Tjek om hytten er optaget (bruger cabin_number som spot_number)
    const isOccupied = occupiedCabins.seasonal.has(cabin.cabin_number) || 
                       occupiedCabins.regular.has(cabin.cabin_number);
    
    return isOccupied ? COLORS.cabinOnlineOccupied : COLORS.cabinOnlineEmpty;
  };

  const handleDragEnd = async (type: "stand" | "cabin" | "repeater" | "spot" | "meter", id: string, x: number, y: number) => {
    if (isLocked) return;
    
    try {
      // Repeatere der er auto-detekteret fra power_meters skal opdatere power_meters
      // Vi tjekker om repeateren findes i repeaters-tabellen eller er fra power_meters
      let table = type === "stand" ? "power_stands" 
        : type === "cabin" ? "cabins"
        : type === "spot" ? "map_spots"
        : "power_meters";
      
      // For repeatere: tjek om det er fra power_meters (auto-detekteret)
      if (type === "repeater") {
        // Auto-detekterede repeatere har ID fra power_meters, så opdater der
        table = "power_meters";
      }
      
      await (supabase as any)
        .from(table)
        .update({ map_x: x, map_y: y })
        .eq("id", id);
      
      // Optimistisk opdatering
      if (type === "stand") {
        setStands((prev) => prev.map((s) => (s.id === id ? { ...s, map_x: x, map_y: y } : s)));
      } else if (type === "cabin") {
        setCabins((prev) => prev.map((c) => (c.id === id ? { ...c, map_x: x, map_y: y } : c)));
      } else if (type === "repeater") {
        setRepeaters((prev) => prev.map((r) => (r.id === id ? { ...r, map_x: x, map_y: y } : r)));
      } else if (type === "spot") {
        setSpots((prev) => prev.map((s) => (s.id === id ? { ...s, map_x: x, map_y: y } : s)));
      }
    } catch (error) {
      toast.error("Kunne ikke gemme position");
      fetchData();
    }
  };

  // Plads-farve baseret på booking-status
  const getSpotColor = (spot: MapSpot): string => {
    if (spot.customer_type === "seasonal") {
      return spot.winter_storage ? COLORS.spotSeasonalWinter : COLORS.spotSeasonal;
    }
    if (spot.customer_type === "regular") return COLORS.spotRegular;
    return COLORS.spotAvailable;
  };

  // Upload baggrundsbillede
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info("Uploader baggrundsbillede...");
      
      // Upload til Supabase Storage
      const fileName = `map-background-${Date.now()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("map-backgrounds")
        .upload(fileName, file);

      if (uploadError) {
        // Hvis bucket ikke findes, prøv at oprette den først
        console.error("Upload fejl:", uploadError);
        toast.error("Kunne ikke uploade billede. Tjek at 'map-backgrounds' bucket eksisterer i Supabase Storage.");
        return;
      }

      // Hent public URL
      const { data: urlData } = supabase.storage
        .from("map-backgrounds")
        .getPublicUrl(fileName);

      // Opdater map_config
      await (supabase as any)
        .from("map_config")
        .upsert({
          id: "main",
          image_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        });

      toast.success("Baggrundsbillede uploadet!");
      fetchData();
    } catch (error) {
      console.error("Upload fejl:", error);
      toast.error("Kunne ikke uploade billede");
    }
  };

  // Gem indstillinger
  const saveSettings = async () => {
    try {
      await (supabase as any)
        .from("map_config")
        .upsert({
          id: "main",
          settings: tempSettings,
          updated_at: new Date().toISOString(),
        });

      setMapConfig((prev) => ({ ...prev, settings: tempSettings }));
      setShowSettings(false);
      toast.success("Indstillinger gemt!");
    } catch (error) {
      toast.error("Kunne ikke gemme indstillinger");
    }
  };

  // Print funktion
  const handlePrint = () => {
    const stage = stageRef.current;
    if (!stage || !backgroundImage) {
      toast.error("Kort ikke indlæst");
      return;
    }

    try {
      // Gem nuværende zoom/position
      const oldScale = stage.scaleX();
      const oldPos = { x: stage.x(), y: stage.y() };
      
      // Nulstil til 100% zoom og position (0,0)
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      
      // Eksporter hele kortet baseret på baggrundsbilledets størrelse
      const dataUrl = stage.toDataURL({ 
        x: 0,
        y: 0,
        width: backgroundImage.width,
        height: backgroundImage.height,
        pixelRatio: 2,
        mimeType: "image/png",
      });
      
      // Gendan zoom/position
      stage.scale({ x: oldScale, y: oldScale });
      stage.position(oldPos);
      stage.batchDraw();
      
      if (!dataUrl || dataUrl === "data:,") {
        toast.info("Kunne ikke eksportere kort");
        return;
      }
      
      // Åbn print-vindue
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Jelling Camping - Oversigtskort</title>
              <style>
                @page { 
                  size: landscape;
                  margin: 0;
                }
                body { 
                  margin: 0; 
                  padding: 0;
                  display: flex; 
                  justify-content: center; 
                  align-items: center;
                  height: 100vh;
                }
                img { 
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                }
              </style>
            </head>
            <body>
              <img src="${dataUrl}" onload="setTimeout(function() { window.print(); }, 200);" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      console.error("Print fejl:", error);
      toast.error("Print fejlede");
    }
  };

  // Opret ny plads
  const createSpot = async (spotNumber: string) => {
    if (!spotNumber.trim()) return;
    
    try {
      await (supabase as any)
        .from("map_spots")
        .insert({ spot_number: spotNumber.trim() });
      
      toast.success(`Plads "${spotNumber}" oprettet`);
      fetchData();
    } catch (error) {
      toast.error("Kunne ikke oprette plads");
    }
  };

  // Hent kundedata for valgt plads
  const fetchSpotCustomer = async (spotNumber: string) => {
    setLoadingCustomer(true);
    setSpotCustomer(null);
    
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    try {
      // Tjek sæsongæster først (afrejsedag = ledig)
      const { data: seasonal } = await (supabase as any)
        .from("seasonal_customers")
        .select("*")
        .eq("spot_number", spotNumber)
        .lte("arrival_date", dateStr)
        .gt("departure_date", dateStr)
        .maybeSingle();
      
      if (seasonal) {
        setSpotCustomer({ ...seasonal, type: "seasonal" });
        setLoadingCustomer(false);
        return;
      }
      
      // Tjek kørende gæster (afrejsedag = ledig)
      const { data: regular } = await (supabase as any)
        .from("regular_customers")
        .select("*")
        .eq("spot_number", spotNumber)
        .lte("arrival_date", dateStr)
        .gt("departure_date", dateStr)
        .maybeSingle();
      
      if (regular) {
        setSpotCustomer({ ...regular, type: "regular" });
      }
    } catch (error) {
      console.error("Fejl ved hentning af kunde:", error);
    }
    setLoadingCustomer(false);
  };

  // Når en plads vælges, hent kundedata
  const handleSpotClick = (spot: MapSpot) => {
    setSelectedSpot(spot);
    if (spot.customer_type) {
      fetchSpotCustomer(spot.spot_number);
    } else {
      setSpotCustomer(null);
    }
  };

  // Hent kundedata for hytte (bruger cabin_number som spot_number)
  const fetchCabinCustomer = async (cabinNumber: string) => {
    setLoadingCustomer(true);
    setCabinCustomer(null);
    
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    try {
      // Tjek sæsongæster
      const { data: seasonal } = await (supabase as any)
        .from("seasonal_customers")
        .select("*")
        .eq("spot_number", cabinNumber)
        .lte("arrival_date", dateStr)
        .gt("departure_date", dateStr)
        .maybeSingle();
      
      if (seasonal) {
        setCabinCustomer({ ...seasonal, type: "seasonal" });
        setLoadingCustomer(false);
        return;
      }
      
      // Tjek kørende gæster
      const { data: regular } = await (supabase as any)
        .from("regular_customers")
        .select("*")
        .eq("spot_number", cabinNumber)
        .lte("arrival_date", dateStr)
        .gt("departure_date", dateStr)
        .maybeSingle();
      
      if (regular) {
        setCabinCustomer({ ...regular, type: "regular" });
      }
    } catch (error) {
      console.error("Fejl ved hentning af hytte-kunde:", error);
    }
    setLoadingCustomer(false);
  };

  // Når en hytte vælges, hent kundedata
  const handleCabinClick = (cabin: Cabin) => {
    setSelectedCabin(cabin);
    fetchCabinCustomer(cabin.cabin_number);
  };

  const handleZoom = (direction: "in" | "out") => {
    const scaleBy = 1.2;
    const newScale = direction === "in" ? scale * scaleBy : scale / scaleBy;
    setScale(Math.max(0.1, Math.min(5, newScale)));
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    setScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  // Auto-positioner for elementer uden position
  const getAutoPosition = (index: number, total: number, type: "stand" | "cabin" | "meter") => {
    const cols = type === "stand" ? 8 : type === "cabin" ? 6 : 10;
    const spacing = type === "stand" ? 100 : type === "cabin" ? 80 : 60;
    const startX = 50;
    const startY = type === "cabin" ? 400 : type === "meter" ? 600 : 50;
    return {
      x: startX + (index % cols) * spacing,
      y: startY + Math.floor(index / cols) * spacing,
    };
  };

  // ============ STATISTIK ============

  const stats = {
    totalStands: stands.length,
    onlineStands: stands.filter((s) => s.meters.length > 0 && s.meters.every((m) => m.is_online)).length,
    offlineStands: stands.filter((s) => s.meters.length > 0 && s.meters.every((m) => !m.is_online)).length,
    totalCabins: cabins.length,
    totalRepeaters: repeaters.length,
    onlineRepeaters: repeaters.filter((r) => r.is_online).length,
    totalSpots: spots.length,
    unassignedCount: unassignedMeters.length,
  };

  // State for ny plads-dialog
  const [newSpotNumber, setNewSpotNumber] = useState("");
  const [showNewSpotDialog, setShowNewSpotDialog] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {isStaff ? <StaffSidebar /> : <AdminSidebar />}
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold">Oversigtskort</h1>
                  <p className="text-muted-foreground text-sm">
                    {stats.totalStands} standere | {cabins.length} hytter | {stats.unassignedCount} ikke-tildelte målere
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleZoom("out")}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
                <Button variant="outline" size="sm" onClick={() => handleZoom("in")}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant={isLocked ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsLocked(!isLocked)}
                  title={isLocked ? "Lås op for redigering" : "Lås positioner"}
                >
                  {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} title="Print kort">
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} title="Indstillinger">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 flex">
            {/* Sidebar med filtre */}
            <div className="w-64 border-r bg-card p-4 space-y-4 overflow-y-auto">
              {/* Dato-vælger */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Vis bookinger for dato
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, "d. MMMM yyyy", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        locale={da}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground mt-2">
                    Viser pladser der er booket på valgt dato
                  </p>
                </CardContent>
              </Card>

              {/* Filtre */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Vis/Skjul</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-stands" className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500" />
                      Standere ({stats.totalStands})
                    </Label>
                    <Switch id="show-stands" checked={showStands} onCheckedChange={setShowStands} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-cabins" className="flex items-center gap-2">
                      <Home className="h-3 w-3" />
                      Hytter ({cabins.length})
                    </Label>
                    <Switch id="show-cabins" checked={showCabins} onCheckedChange={setShowCabins} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-repeaters" className="flex items-center gap-2">
                      <Triangle className="h-3 w-3 text-blue-500" />
                      Repeatere ({stats.totalRepeaters})
                    </Label>
                    <Switch id="show-repeaters" checked={showRepeaters} onCheckedChange={setShowRepeaters} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-spots" className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      Pladser ({stats.totalSpots})
                    </Label>
                    <Switch id="show-spots" checked={showSpots} onCheckedChange={setShowSpots} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-unassigned" className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500" />
                      Ikke-tildelte ({stats.unassignedCount})
                    </Label>
                    <Switch id="show-unassigned" checked={showUnassigned} onCheckedChange={setShowUnassigned} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-main-boards" className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-red-500" />
                      Hovedtavler ({mainBoards.length})
                    </Label>
                    <Switch id="show-main-boards" checked={showMainBoards} onCheckedChange={setShowMainBoards} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-boards" className="flex items-center gap-2">
                      <CircuitBoard className="h-3 w-3 text-orange-500" />
                      Undertavler ({distributionBoards.length})
                    </Label>
                    <Switch id="show-boards" checked={showBoards} onCheckedChange={setShowBoards} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-connections" className="flex items-center gap-2">
                      <Cable className="h-3 w-3 text-blue-500" />
                      Forbindelser
                    </Label>
                    <Switch id="show-connections" checked={showConnections} onCheckedChange={setShowConnections} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-board-connections" className="flex items-center gap-2">
                      <Link2 className="h-3 w-3 text-gray-500" />
                      Tavle-forbindelser
                    </Label>
                    <Switch id="show-board-connections" checked={showBoardConnections} onCheckedChange={setShowBoardConnections} />
                  </div>
                </CardContent>
              </Card>

              {/* El-infrastruktur filter */}
              {(distributionBoards.length > 0 || fuseGroups.length > 0) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CircuitBoard className="h-4 w-4" />
                      El-filter
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Undertavle</Label>
                      <Select value={filterBoard} onValueChange={(v) => { setFilterBoard(v); setFilterFuseGroup("all"); }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle tavler</SelectItem>
                          {distributionBoards.map((board) => (
                            <SelectItem key={board.id} value={board.id}>
                              {board.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Sikringsgruppe</Label>
                      <Select value={filterFuseGroup} onValueChange={setFilterFuseGroup}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle grupper</SelectItem>
                          {fuseGroups
                            .filter((fg) => filterBoard === "all" || fg.board_id === filterBoard)
                            .map((fg) => (
                              <SelectItem key={fg.id} value={fg.id}>
                                Gruppe {fg.group_number} {fg.name && `(${fg.name})`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Farve-legende */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Farve-koder</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-3">
                  <div>
                    <p className="font-semibold mb-1">Standere (cirkler)</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.standAllOnline }} />
                        <span>Alle online</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.standPartialOffline }} />
                        <span>Delvist offline</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.standAllOffline }} />
                        <span>Alle offline</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Hytter (nummer)</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: COLORS.cabinOnlineOccupied }}>26</span>
                        <span>Beboet + online</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: COLORS.cabinOnlineEmpty }}>26</span>
                        <span>Ledig + online</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: COLORS.cabinOffline }}>26</span>
                        <span>Offline</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Repeatere (trekanter)</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3" style={{ backgroundColor: COLORS.repeaterOnline, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
                        <span>Online</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3" style={{ backgroundColor: COLORS.repeaterOffline, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
                        <span>Offline</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Pladser (nummer)</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: COLORS.spotAvailable }}>500</span>
                        <span>Ledig</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: COLORS.spotSeasonal }}>500</span>
                        <span>Sæsongæst</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: COLORS.spotSeasonalWinter }}>500</span>
                        <span>Vinteropbevaring</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: COLORS.spotRegular }}>500</span>
                        <span>Kørende gæst</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Handlinger - kun for admin */}
              {!isStaff && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Handlinger</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleBackgroundUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload baggrund
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setShowNewSpotDialog(true)}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Opret plads
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Hurtig-statistik */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Status</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Online standere:</span>
                    <span className="text-green-600 font-medium">{stats.onlineStands}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Offline standere:</span>
                    <span className="text-red-600 font-medium">{stats.offlineStands}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ikke-tildelte:</span>
                    <span className="text-orange-600 font-medium">{stats.unassignedCount}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Kort canvas */}
            <div ref={containerRef} className="flex-1 bg-slate-100 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Stage
                  ref={stageRef}
                  width={stageSize.width}
                  height={stageSize.height}
                  scaleX={scale}
                  scaleY={scale}
                  x={stagePos.x}
                  y={stagePos.y}
                  draggable={true}
                  onWheel={handleWheel}
                  onDragEnd={(e) => {
                    if (e.target === stageRef.current) {
                      setStagePos({ x: e.target.x(), y: e.target.y() });
                    }
                  }}
                >
                  <Layer>
                    {/* Baggrundsbillede */}
                    {backgroundImage && (
                      <KonvaImage
                        image={backgroundImage}
                        x={0}
                        y={0}
                        opacity={1}
                      />
                    )}

                    {/* Render Pladser (først, så de er i baggrunden) */}
                    {showSpots && spots.map((spot, index) => {
                      const pos = spot.map_x !== null && spot.map_y !== null
                        ? { x: spot.map_x, y: spot.map_y }
                        : { x: 100 + (index % 10) * 50, y: 950 + Math.floor(index / 10) * 30 };
                      const color = getSpotColor(spot);

                      return (
                        <Text
                          key={spot.id}
                          x={pos.x}
                          y={pos.y}
                          text={spot.spot_number}
                          fontSize={mapConfig.settings.spotFontSize}
                          fill={color}
                          fontStyle="bold"
                          draggable={!isLocked && !spot.map_locked}
                          onClick={() => handleSpotClick(spot)}
                          onTap={() => handleSpotClick(spot)}
                          onDragEnd={(e) => handleDragEnd("spot", spot.id, e.target.x(), e.target.y())}
                        />
                      );
                    })}

                    {/* Render Repeatere (trekanter) */}
                    {showRepeaters && repeaters.map((repeater, index) => {
                      const pos = repeater.map_x !== null && repeater.map_y !== null
                        ? { x: repeater.map_x, y: repeater.map_y }
                        : { x: 900 + (index % 4) * 60, y: 50 + Math.floor(index / 4) * 60 };
                      const color = repeater.is_online ? COLORS.repeaterOnline : COLORS.repeaterOffline;

                      return (
                        <React.Fragment key={repeater.id}>
                          <RegularPolygon
                            x={pos.x}
                            y={pos.y}
                            sides={3}
                            radius={mapConfig.settings.repeaterSize}
                            fill={color}
                            stroke="#000"
                            strokeWidth={1}
                            draggable={!isLocked && !repeater.map_locked}
                            onDragEnd={(e) => handleDragEnd("repeater", repeater.id, e.target.x(), e.target.y())}
                          />
                          <Text
                            x={pos.x - 20}
                            y={pos.y + mapConfig.settings.repeaterSize + 3}
                            text={repeater.name}
                            fontSize={8}
                            fill="#333"
                            width={40}
                            align="center"
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* Render Forbindelseslinjer */}
                    {showConnections && stands
                      .filter((stand) => stand.board_id && stand.fuse_group_id)
                      .map((stand) => {
                        const board = distributionBoards.find((b) => b.id === stand.board_id);
                        if (!board) return null;
                        
                        const standPos = stand.map_x !== null && stand.map_y !== null
                          ? { x: stand.map_x, y: stand.map_y }
                          : { x: 0, y: 0 };
                        const boardPos = board.map_x !== null && board.map_y !== null
                          ? { x: board.map_x, y: board.map_y }
                          : { x: 0, y: 0 };
                        
                        if (standPos.x === 0 || boardPos.x === 0) return null;
                        
                        return (
                          <Line
                            key={`conn-${stand.id}`}
                            points={[boardPos.x, boardPos.y, standPos.x, standPos.y]}
                            stroke={board.color || "#F59E0B"}
                            strokeWidth={1}
                            opacity={0.5}
                            dash={[5, 5]}
                          />
                        );
                      })}

                    {/* Render Tavle-forbindelser */}
                    {showBoardConnections && boardConnections.map((conn) => {
                      const fromBoard = distributionBoards.find(b => b.id === conn.from_board_id);
                      const toBoard = distributionBoards.find(b => b.id === conn.to_board_id);
                      
                      if (!fromBoard || !toBoard) return null;
                      
                      const fromPos = fromBoard.map_x !== null && fromBoard.map_y !== null
                        ? { x: fromBoard.map_x, y: fromBoard.map_y }
                        : { x: 0, y: 0 };
                      const toPos = toBoard.map_x !== null && toBoard.map_y !== null
                        ? { x: toBoard.map_x, y: toBoard.map_y }
                        : { x: 0, y: 0 };
                      
                      if (fromPos.x === 0 || toPos.x === 0) return null;
                      
                      return (
                        <Line
                          key={`board-conn-${conn.id}`}
                          points={[fromPos.x, fromPos.y, toPos.x, toPos.y]}
                          stroke={conn.color || "#666666"}
                          strokeWidth={3}
                          opacity={0.8}
                        />
                      );
                    })}

                    {/* Render Forbindelser fra Undertavler til Hovedtavler */}
                    {showMainBoards && showBoards && distributionBoards
                      .filter(board => board.main_board_id && board.map_x !== null && board.map_y !== null)
                      .map((board) => {
                        const mainBoard = mainBoards.find(mb => mb.id === board.main_board_id);
                        if (!mainBoard || mainBoard.map_x === null || mainBoard.map_y === null) return null;

                        return (
                          <Line
                            key={`main-board-conn-${board.id}`}
                            points={[mainBoard.map_x, mainBoard.map_y, board.map_x!, board.map_y!]}
                            stroke="#DC2626"
                            strokeWidth={2}
                            opacity={0.6}
                            dash={[8, 4]}
                          />
                        );
                      })}

                    {/* Render Hovedtavler */}
                    {showMainBoards && mainBoards.map((mainBoard, index) => {
                      const pos = mainBoard.map_x !== null && mainBoard.map_y !== null
                        ? { x: mainBoard.map_x, y: mainBoard.map_y }
                        : { x: 100 + index * 200, y: 30 };

                      return (
                        <React.Fragment key={mainBoard.id}>
                          <Rect
                            x={pos.x - 50}
                            y={pos.y - 20}
                            width={100}
                            height={40}
                            fill="#DC2626"
                            stroke="#000"
                            strokeWidth={2}
                            cornerRadius={6}
                            draggable={!isLocked && !mainBoard.map_locked}
                            onDragEnd={(e) => {
                              const newX = e.target.x() + 50;
                              const newY = e.target.y() + 20;
                              (supabase as any)
                                .from("main_boards")
                                .update({ map_x: newX, map_y: newY })
                                .eq("id", mainBoard.id)
                                .then(() => {
                                  setMainBoards((prev) => 
                                    prev.map((b) => b.id === mainBoard.id ? { ...b, map_x: newX, map_y: newY } : b)
                                  );
                                });
                            }}
                          />
                          <Text
                            x={pos.x - 45}
                            y={pos.y - 6}
                            text={mainBoard.name}
                            fontSize={12}
                            fontStyle="bold"
                            fill="#FFF"
                            width={90}
                            align="center"
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* Render Undertavler */}
                    {showBoards && distributionBoards.map((board, index) => {
                      const boardW = mapConfig.settings.boardWidth || 60;
                      const boardH = mapConfig.settings.boardHeight || 35;
                      const pos = board.map_x !== null && board.map_y !== null
                        ? { x: board.map_x, y: board.map_y }
                        : { x: 50 + (index % 4) * 120, y: 50 + Math.floor(index / 4) * 80 };

                      return (
                        <React.Fragment key={board.id}>
                          <Rect
                            x={pos.x - boardW / 2}
                            y={pos.y - boardH / 2}
                            width={boardW}
                            height={boardH}
                            fill={board.color || "#F59E0B"}
                            stroke="#000"
                            strokeWidth={1}
                            cornerRadius={4}
                            draggable={!isLocked && !board.map_locked}
                            onDragEnd={(e) => {
                              const newX = e.target.x() + boardW / 2;
                              const newY = e.target.y() + boardH / 2;
                              (supabase as any)
                                .from("distribution_boards")
                                .update({ map_x: newX, map_y: newY })
                                .eq("id", board.id)
                                .then(() => {
                                  setDistributionBoards((prev) => 
                                    prev.map((b) => b.id === board.id ? { ...b, map_x: newX, map_y: newY } : b)
                                  );
                                });
                            }}
                          />
                          <Text
                            x={pos.x - boardW / 2 + 5}
                            y={pos.y - 5}
                            text={board.name}
                            fontSize={10}
                            fill="#000"
                            width={boardW - 10}
                            align="center"
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* Render Standere */}
                    {showStands && stands
                      .filter((stand) => {
                        // Filter på undertavle
                        if (filterBoard !== "all" && stand.board_id !== filterBoard) return false;
                        // Filter på sikringsgruppe
                        if (filterFuseGroup !== "all" && stand.fuse_group_id !== filterFuseGroup) return false;
                        return true;
                      })
                      .map((stand, index) => {
                      const pos = stand.map_x !== null && stand.map_y !== null
                        ? { x: stand.map_x, y: stand.map_y }
                        : getAutoPosition(index, stands.length, "stand");
                      const color = getStandColor(stand);
                      const isOffline = hasOfflineMeters(stand);

                      return (
                        <React.Fragment key={stand.id}>
                          <Circle
                            x={pos.x}
                            y={pos.y}
                            radius={mapConfig.settings.standRadius}
                            fill={color}
                            stroke="#000"
                            strokeWidth={selectedStand?.id === stand.id ? 3 : 1}
                            opacity={isOffline ? (blinkOn ? 1 : 0.4) : 1}
                            draggable={!isLocked && !stand.map_locked}
                            onClick={() => setSelectedStand(stand)}
                            onTap={() => setSelectedStand(stand)}
                            onDragEnd={(e) => handleDragEnd("stand", stand.id, e.target.x(), e.target.y())}
                            shadowBlur={selectedStand?.id === stand.id ? 10 : 0}
                          />
                          {/* Sort baggrund til stander nummer */}
                          <Rect
                            x={pos.x - 15}
                            y={pos.y + mapConfig.settings.standRadius + 3}
                            width={30}
                            height={mapConfig.settings.standFontSize + 6}
                            fill="#000000"
                            cornerRadius={3}
                          />
                          <Text
                            x={pos.x - 15}
                            y={pos.y + mapConfig.settings.standRadius + 6}
                            text={stand.name}
                            fontSize={mapConfig.settings.standFontSize}
                            fill="#FFD700"
                            fontStyle="bold"
                            width={30}
                            align="center"
                          />
                          {/* Vis antal målere */}
                          <Text
                            x={pos.x - 10}
                            y={pos.y - 6}
                            text={stand.meters.length.toString()}
                            fontSize={12}
                            fill="#fff"
                            fontStyle="bold"
                            width={20}
                            align="center"
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* Render Forbindelser fra Hytter til Undertavler */}
                    {showCabins && showBoards && cabins
                      .filter(cabin => cabin.distribution_board_id && cabin.map_x != null && cabin.map_y != null)
                      .map((cabin) => {
                        const board = distributionBoards.find(b => b.id === cabin.distribution_board_id);
                        if (!board || board.map_x === null || board.map_y === null) return null;

                        return (
                          <Line
                            key={`cabin-board-${cabin.id}`}
                            points={[board.map_x, board.map_y, cabin.map_x!, cabin.map_y!]}
                            stroke={board.color || "#F59E0B"}
                            strokeWidth={1}
                            opacity={0.5}
                            dash={[3, 3]}
                          />
                        );
                      })}

                    {/* Render Hytter med baggrundscirkel for status */}
                    {showCabins && cabins.map((cabin, index) => {
                      const pos = cabin.map_x !== null && cabin.map_y !== null
                        ? { x: cabin.map_x, y: cabin.map_y }
                        : getAutoPosition(index, cabins.length, "cabin");
                      const color = getCabinColor(cabin);
                      
                      // Strip "Hytte " prefix
                      const displayNumber = cabin.cabin_number.replace(/^Hytte\s*/i, "");
                      
                      // Bestem baggrundscirkel farve baseret på status
                      const meter = allMeters.find((m) => m.meter_number === cabin.meter_id);
                      const isOffline = !meter || !meter.is_online;
                      const isOccupied = occupiedCabins.seasonal.has(cabin.cabin_number) || 
                                         occupiedCabins.regular.has(cabin.cabin_number);
                      
                      // Gul = offline, Grøn = optaget, ingen = online/ledig
                      const showBackground = isOffline || isOccupied;
                      const bgColor = isOffline ? "#FBBF24" : "#22C55E"; // Gul eller Grøn

                      const circleRadius = 28;
                      const fontSize = mapConfig.settings.cabinFontSize || 16;

                      return (
                        <React.Fragment key={cabin.id}>
                          {showBackground && (
                            <Circle
                              x={pos.x}
                              y={pos.y}
                              radius={circleRadius}
                              fill={bgColor}
                              opacity={isOffline ? (blinkOn ? 0.9 : 0.3) : 0.8}
                            />
                          )}
                          <Text
                            x={pos.x}
                            y={pos.y}
                            text={displayNumber}
                            fontSize={fontSize}
                            fill="#000000"
                            stroke={isOffline ? "#000" : color}
                            strokeWidth={0.5}
                            fontStyle="bold"
                            offsetX={displayNumber.length > 1 ? fontSize * 0.6 : fontSize * 0.3}
                            offsetY={fontSize * 0.5}
                            draggable={!isLocked && !cabin.map_locked}
                            onClick={() => handleCabinClick(cabin)}
                            onTap={() => handleCabinClick(cabin)}
                            onDragEnd={(e) => handleDragEnd("cabin", cabin.id, e.target.x(), e.target.y())}
                            shadowBlur={selectedCabin?.id === cabin.id ? 5 : 0}
                            shadowColor="#000"
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* Render Ikke-tildelte målere */}
                    {showUnassigned && unassignedMeters.map((meter, index) => {
                      const pos = meter.map_x !== null && meter.map_y !== null
                        ? { x: meter.map_x, y: meter.map_y }
                        : getAutoPosition(index, unassignedMeters.length, "meter");

                      return (
                        <React.Fragment key={meter.id}>
                          <Circle
                            x={pos.x}
                            y={pos.y}
                            radius={8}
                            fill={meter.is_online ? "#F97316" : "#DC2626"}
                            stroke="#000"
                            strokeWidth={1}
                          />
                          <Text
                            x={pos.x - 25}
                            y={pos.y + 12}
                            text={meter.meter_number}
                            fontSize={8}
                            fill="#666"
                            width={50}
                            align="center"
                          />
                        </React.Fragment>
                      );
                    })}
                  </Layer>
                </Stage>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal: Stander detaljer */}
      <Dialog open={!!selectedStand} onOpenChange={(open) => !open && setSelectedStand(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedStand ? getStandColor(selectedStand) : "#ccc" }}
              />
              {selectedStand?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {selectedStand?.meters.length || 0} måler(e) tilknyttet
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedStand?.meters.map((meter) => (
                  <div
                    key={meter.id}
                    className="flex items-center justify-between p-2 bg-accent rounded"
                  >
                    <div className="flex items-center gap-2">
                      {meter.is_online ? (
                        <Zap className="h-4 w-4 text-green-500" />
                      ) : (
                        <ZapOff className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-mono">{meter.meter_number}</span>
                    </div>
                    <Badge variant={meter.is_online ? "default" : "destructive"}>
                      {meter.is_online ? "Online" : "Offline"}
                    </Badge>
                  </div>
                ))}
                {selectedStand?.meters.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Ingen målere tilknyttet denne stander
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Hytte detaljer */}
      <Dialog open={!!selectedCabin} onOpenChange={(open) => { if (!open) { setSelectedCabin(null); setCabinCustomer(null); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Hytte {selectedCabin?.cabin_number}
              {cabinCustomer && (
                <Badge variant={cabinCustomer.type === "seasonal" ? "destructive" : "default"}>
                  {cabinCustomer.type === "seasonal" ? "Sæsongæst" : "Kørende gæst"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Hytte info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Hytte nummer</p>
                <p className="font-medium">{selectedCabin?.cabin_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status for {format(selectedDate, "d. MMM yyyy", { locale: da })}</p>
                <p className="font-medium">{cabinCustomer ? "Optaget" : "Ledig"}</p>
              </div>
            </div>

            {/* Måler info */}
            {selectedCabin?.meter_id && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Måler-info
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Måler</p>
                    <p className="font-medium">{selectedCabin.meter_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">
                      {allMeters.find(m => m.meter_number === selectedCabin.meter_id)?.is_online 
                        ? "🟢 Online" : "🔴 Offline"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Kunde info */}
            {loadingCustomer && (
              <div className="text-center py-4 text-muted-foreground">
                Henter kundedata...
              </div>
            )}
            
            {cabinCustomer && !loadingCustomer && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  👤 Kundeoplysninger
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Navn</p>
                    <p className="font-medium">{cabinCustomer.first_name} {cabinCustomer.last_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Booking ID</p>
                    <p className="font-medium">{cabinCustomer.booking_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ankomst</p>
                    <p className="font-medium">{cabinCustomer.arrival_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Afrejse</p>
                    <p className="font-medium">{cabinCustomer.departure_date}</p>
                  </div>
                  {cabinCustomer.email && (
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{cabinCustomer.email}</p>
                    </div>
                  )}
                  {cabinCustomer.phone && (
                    <div>
                      <p className="text-muted-foreground">Telefon</p>
                      <p className="font-medium">{cabinCustomer.phone}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!cabinCustomer && !loadingCustomer && (
              <div className="text-center py-4 text-muted-foreground">
                Ingen booking på denne dato
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Plads detaljer */}
      <Dialog open={!!selectedSpot} onOpenChange={(open) => { if (!open) { setSelectedSpot(null); setSpotCustomer(null); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Plads {selectedSpot?.spot_number}
              {selectedSpot?.customer_type && (
                <Badge variant={selectedSpot.customer_type === "seasonal" ? "destructive" : "default"}>
                  {selectedSpot.customer_type === "seasonal" ? "Sæsongæst" : "Kørende gæst"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Plads info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Plads nummer</p>
                <p className="font-medium">{selectedSpot?.spot_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status for {format(selectedDate, "d. MMM yyyy", { locale: da })}</p>
                <p className="font-medium">
                  {selectedSpot?.customer_type === "seasonal" ? "Optaget (Sæson)" 
                    : selectedSpot?.customer_type === "regular" ? "Optaget (Kørende)" 
                    : "Ledig"}
                </p>
              </div>
            </div>

            {/* Kunde info */}
            {loadingCustomer && (
              <div className="text-center py-4 text-muted-foreground">
                Henter kundedata...
              </div>
            )}
            
            {spotCustomer && !loadingCustomer && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  👤 Kundeoplysninger
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Navn</p>
                    <p className="font-medium">{spotCustomer.first_name} {spotCustomer.last_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Booking ID</p>
                    <p className="font-medium">{spotCustomer.booking_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ankomst</p>
                    <p className="font-medium">{spotCustomer.arrival_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Afrejse</p>
                    <p className="font-medium">{spotCustomer.departure_date}</p>
                  </div>
                  {spotCustomer.email && (
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{spotCustomer.email}</p>
                    </div>
                  )}
                  {spotCustomer.phone && (
                    <div>
                      <p className="text-muted-foreground">Telefon</p>
                      <p className="font-medium">{spotCustomer.phone}</p>
                    </div>
                  )}
                  {spotCustomer.license_plates && spotCustomer.license_plates.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Nummerplader</p>
                      <p className="font-medium">{spotCustomer.license_plates.join(", ")}</p>
                    </div>
                  )}
                  {spotCustomer.checked_in !== undefined && (
                    <div>
                      <p className="text-muted-foreground">Checked ind</p>
                      <p className="font-medium">{spotCustomer.checked_in ? "✅ Ja" : "❌ Nej"}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!spotCustomer && !loadingCustomer && !selectedSpot?.customer_type && (
              <div className="text-center py-4 text-muted-foreground">
                Ingen booking på denne dato
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Opret ny plads */}
      <Dialog open={showNewSpotDialog} onOpenChange={setShowNewSpotDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Opret ny plads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="spot-number">Pladsnummer</Label>
              <Input
                id="spot-number"
                placeholder="F.eks. 101"
                value={newSpotNumber}
                onChange={(e) => setNewSpotNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    createSpot(newSpotNumber);
                    setNewSpotNumber("");
                    setShowNewSpotDialog(false);
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSpotDialog(false)}>
              Annuller
            </Button>
            <Button onClick={() => {
              createSpot(newSpotNumber);
              setNewSpotNumber("");
              setShowNewSpotDialog(false);
            }}>
              Opret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Indstillinger */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Kort-indstillinger
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <div>
                <Label>Stander-radius: {tempSettings.standRadius}px</Label>
                <Slider
                  value={[tempSettings.standRadius]}
                  onValueChange={([v]) => setTempSettings({ ...tempSettings, standRadius: v })}
                  min={10}
                  max={50}
                  step={1}
                />
              </div>
              <div>
                <Label>Stander tekst: {tempSettings.standFontSize}px</Label>
                <Slider
                  value={[tempSettings.standFontSize]}
                  onValueChange={([v]) => setTempSettings({ ...tempSettings, standFontSize: v })}
                  min={6}
                  max={20}
                  step={1}
                />
              </div>
              <div>
                <Label>Hytte tekst: {tempSettings.cabinFontSize}px</Label>
                <Slider
                  value={[tempSettings.cabinFontSize]}
                  onValueChange={([v]) => setTempSettings({ ...tempSettings, cabinFontSize: v })}
                  min={15}
                  max={40}
                  step={1}
                />
              </div>
              <div>
                <Label>Plads tekst: {tempSettings.spotFontSize}px</Label>
                <Slider
                  value={[tempSettings.spotFontSize]}
                  onValueChange={([v]) => setTempSettings({ ...tempSettings, spotFontSize: v })}
                  min={15}
                  max={40}
                  step={1}
                />
              </div>
              <div>
                <Label>Repeater-størrelse: {tempSettings.repeaterSize}px</Label>
                <Slider
                  value={[tempSettings.repeaterSize]}
                  onValueChange={([v]) => setTempSettings({ ...tempSettings, repeaterSize: v })}
                  min={8}
                  max={30}
                  step={1}
                />
              </div>
              <div>
                <Label>Undertavle bredde: {tempSettings.boardWidth || 60}px</Label>
                <Slider
                  value={[tempSettings.boardWidth || 60]}
                  onValueChange={([v]) => setTempSettings({ ...tempSettings, boardWidth: v })}
                  min={40}
                  max={120}
                  step={5}
                />
              </div>
              <div>
                <Label>Undertavle højde: {tempSettings.boardHeight || 35}px</Label>
                <Slider
                  value={[tempSettings.boardHeight || 35]}
                  onValueChange={([v]) => setTempSettings({ ...tempSettings, boardHeight: v })}
                  min={20}
                  max={80}
                  step={5}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTempSettings(mapConfig.settings);
              setShowSettings(false);
            }}>
              Annuller
            </Button>
            <Button onClick={saveSettings}>
              <Save className="h-4 w-4 mr-2" />
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Kort;
