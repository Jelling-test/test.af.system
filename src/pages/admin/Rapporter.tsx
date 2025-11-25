import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { formatDanishDateTime, formatDanishTime, getDanishNow } from "@/utils/dateTime";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Calendar as CalendarIcon,
  Download,
  Mail,
  FileText,
  TrendingUp,
  Users,
  Gauge,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const AdminRapporter = () => {
  const [loading, setLoading] = useState(false);
  
  // Date states
  const [dailyReportDate, setDailyReportDate] = useState<Date>(new Date());
  const [salesStartDate, setSalesStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [salesEndDate, setSalesEndDate] = useState<Date>(new Date());
  const [consumptionStartDate, setConsumptionStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [consumptionEndDate, setConsumptionEndDate] = useState<Date>(new Date());
  const [packageHistoryStartDate, setPackageHistoryStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [packageHistoryEndDate, setPackageHistoryEndDate] = useState<Date>(new Date());

  // Report data states
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [consumptionData, setConsumptionData] = useState<any>(null);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [meterStats, setMeterStats] = useState<any>(null);
  const [packageHistoryData, setPackageHistoryData] = useState<any[]>([]);

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    await Promise.all([
      fetchCustomerStats(),
      fetchMeterStats(),
    ]);
  };

  const generateDailyReport = async () => {
    setLoading(true);
    try {
      const dateStr = format(dailyReportDate, "yyyy-MM-dd");
      
      const { data: payments, error } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "betalinger")
        .gte("created_at", `${dateStr}T00:00:00`)
        .lte("created_at", `${dateStr}T23:59:59`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const totalRevenue = payments?.reduce((sum: number, p: any) => {
        return sum + parseFloat(p.data?.beloeb || "0");
      }, 0) || 0;

      setDailyReport({
        date: dateStr,
        totalRevenue,
        transactionCount: payments?.length || 0,
        payments: payments || [],
      });

      toast.success("Daglig rapport genereret");
    } catch (error) {
      console.error("Error generating daily report:", error);
      toast.error("Fejl ved generering af rapport");
    } finally {
      setLoading(false);
    }
  };

  const generateSalesReport = async () => {
    setLoading(true);
    try {
      const { data: payments, error } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "betalinger")
        .gte("created_at", salesStartDate.toISOString())
        .lte("created_at", salesEndDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Process data for charts
      const dailyRevenue: { [key: string]: number } = {};
      const packageRevenue: { [key: string]: number } = {};
      const paymentMethods: { [key: string]: number } = {};

      payments?.forEach((payment: any) => {
        const date = format(new Date(payment.created_at), "yyyy-MM-dd");
        const amount = parseFloat(payment.data?.beloeb || "0");
        const packageName = payment.data?.pakke_navn || "Ukendt";
        const method = payment.data?.metode || "Ukendt";

        dailyRevenue[date] = (dailyRevenue[date] || 0) + amount;
        packageRevenue[packageName] = (packageRevenue[packageName] || 0) + amount;
        paymentMethods[method] = (paymentMethods[method] || 0) + amount;
      });

      setSalesData({
        dailyRevenue,
        packageRevenue,
        paymentMethods,
        totalRevenue: Object.values(dailyRevenue).reduce((a, b) => a + b, 0),
      });

      toast.success("Salgsrapport genereret");
    } catch (error) {
      console.error("Error generating sales report:", error);
      toast.error("Fejl ved generering af salgsrapport");
    } finally {
      setLoading(false);
    }
  };

  const generateConsumptionReport = async () => {
    setLoading(true);
    try {
      // Fetch all active packages in the date range
      const { data: packages, error } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakker")
        .gte("created_at", consumptionStartDate.toISOString())
        .lte("created_at", consumptionEndDate.toISOString());

      if (error) throw error;

      const totalConsumption = packages?.reduce((sum: number, p: any) => {
        return sum + (p.data?.enheder || 0);
      }, 0) || 0;

      const averagePerCustomer = packages?.length 
        ? totalConsumption / new Set(packages.map((p: any) => p.data?.booking_nummer)).size 
        : 0;

      // Mock peak usage times data
      const peakTimes = {
        "00:00-06:00": 120,
        "06:00-12:00": 340,
        "12:00-18:00": 580,
        "18:00-24:00": 450,
      };

      setConsumptionData({
        totalConsumption,
        averagePerCustomer,
        packageCount: packages?.length || 0,
        peakTimes,
      });

      toast.success("Forbrugsrapport genereret");
    } catch (error) {
      console.error("Error generating consumption report:", error);
      toast.error("Fejl ved generering af forbrugsrapport");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerStats = async () => {
    try {
      // Fetch seasonal customers
      const { data: seasonalCustomers, error: seasonalError } = await (supabase as any)
        .from("seasonal_customers")
        .select("*");

      if (seasonalError) throw seasonalError;

      // Fetch regular customers
      const { data: regularCustomers, error: regularError } = await (supabase as any)
        .from("regular_customers")
        .select("*");

      if (regularError) throw regularError;

      const allCustomers = [...(seasonalCustomers || []), ...(regularCustomers || [])];
      const activeCustomers = allCustomers.filter((c: any) => c.checked_in === true).length;
      
      const kundeTypeBreakdown: { [key: string]: number } = {
        "Sæson": seasonalCustomers?.length || 0,
        "Kørende": regularCustomers?.length || 0,
      };

      setCustomerStats({
        totalActive: activeCustomers,
        kundeTypeBreakdown,
        totalBookings: allCustomers.length,
      });
    } catch (error) {
      console.error("Error fetching customer stats:", error);
    }
  };

  const fetchMeterStats = async () => {
    try {
      const { data: meters, error } = await (supabase as any)
        .from("power_meters")
        .select("*");

      if (error) throw error;

      // Get latest readings to determine online/offline status
      const { data: readings } = await (supabase as any)
        .from("meter_readings")
        .select("*")
        .order("time", { ascending: false })
        .limit(1000);

      const latestReadingMap = new Map();
      readings?.forEach((reading: any) => {
        if (!latestReadingMap.has(reading.meter_id)) {
          latestReadingMap.set(reading.meter_id, reading);
        }
      });

      const totalMeters = meters?.length || 0;
      const occupiedMeters = meters?.filter((m: any) => !m.is_available).length || 0;
      const utilizationRate = totalMeters > 0 ? (occupiedMeters / totalMeters) * 100 : 0;

      // Count online/offline meters
      let onlineCount = 0;
      let offlineCount = 0;
      meters?.forEach((m: any) => {
        const reading = latestReadingMap.get(m.meter_number);
        if (reading && new Date(reading.time).getTime() > Date.now() - 2 * 60 * 1000) {
          onlineCount++;
        } else {
          offlineCount++;
        }
      });

      const statusBreakdown: { [key: string]: number } = {
        "Ledig": meters?.filter((m: any) => m.is_available).length || 0,
        "Optaget": occupiedMeters,
      };

      setMeterStats({
        totalMeters,
        occupiedMeters,
        utilizationRate,
        statusBreakdown,
        onlineCount,
        offlineCount,
      });
    } catch (error) {
      console.error("Error fetching meter stats:", error);
    }
  };

  const fetchPackageHistory = async () => {
    if (!packageHistoryStartDate || !packageHistoryEndDate) {
      toast.error("Vælg venligst start og slut dato");
      return;
    }

    setLoading(true);
    try {
      const startStr = format(packageHistoryStartDate, "yyyy-MM-dd");
      const endStr = format(packageHistoryEndDate, "yyyy-MM-dd");

      const { data, error } = await (supabase as any)
        .from("daily_package_stats")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: true })
        .order("kunde_type", { ascending: true })
        .order("betalings_metode", { ascending: true });

      if (error) throw error;

      setPackageHistoryData(data || []);
      toast.success(`Hentet ${data?.length || 0} rækker`);
    } catch (error) {
      console.error("Error fetching package history:", error);
      toast.error("Fejl ved hentning af pakke historik");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = (reportType: string) => {
    toast.info(`${reportType} eksporteres til Excel (ikke implementeret endnu)`);
  };

  const handleSendToAccounting = () => {
    toast.info("Sender rapport til bogholderi (ikke implementeret endnu)");
  };

  // Chart data configurations
  const getDailyRevenueChartData = () => {
    if (!salesData?.dailyRevenue) return null;

    const labels = Object.keys(salesData.dailyRevenue).map((date) =>
      format(new Date(date), "dd/MM", { locale: da })
    );
    const data = Object.values(salesData.dailyRevenue) as number[];

    return {
      labels,
      datasets: [
        {
          label: "Omsætning (DKK)",
          data,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
        },
      ],
    };
  };

  const getPackageRevenueChartData = () => {
    if (!salesData?.packageRevenue) return null;

    return {
      labels: Object.keys(salesData.packageRevenue),
      datasets: [
        {
          label: "Omsætning (DKK)",
          data: Object.values(salesData.packageRevenue) as number[],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(251, 191, 36, 0.8)",
            "rgba(239, 68, 68, 0.8)",
            "rgba(139, 92, 246, 0.8)",
          ],
        },
      ],
    };
  };

  const getPeakTimesChartData = () => {
    if (!consumptionData?.peakTimes) return null;

    return {
      labels: Object.keys(consumptionData.peakTimes),
      datasets: [
        {
          label: "Forbrug (kWh)",
          data: Object.values(consumptionData.peakTimes) as number[],
          backgroundColor: "rgba(59, 130, 246, 0.8)",
        },
      ],
    };
  };

  const getCustomerTypeChartData = () => {
    if (!customerStats?.kundeTypeBreakdown) return null;

    return {
      labels: Object.keys(customerStats.kundeTypeBreakdown),
      datasets: [
        {
          data: Object.values(customerStats.kundeTypeBreakdown) as number[],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(251, 191, 36, 0.8)",
          ],
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full animate-fade-in">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 sm:h-16 border-b bg-background flex items-center px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <h1 className="text-lg sm:text-2xl font-bold ml-4">Rapporter & Analyser</h1>
          </header>
          <main className="flex-1 p-4 sm:p-6 bg-muted/20 space-y-4 sm:space-y-6 overflow-auto">
            {/* Daily Stripe Report */}
            <Card className="animate-scale-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  <span>Daglig Stripe Rapport</span>
                </CardTitle>
                <CardDescription>Generer daglig rapport for Stripe betalinger</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dailyReportDate, "PPP", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={dailyReportDate}
                        onSelect={(date) => date && setDailyReportDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button 
                    onClick={generateDailyReport} 
                    disabled={loading}
                    className="min-h-[44px] w-full sm:w-auto"
                    aria-label="Generer daglig rapport"
                  >
                    Generer rapport
                  </Button>
                </div>

                {dailyReport && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Total Omsætning</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{dailyReport.totalRevenue.toFixed(2)} DKK</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Antal Transaktioner</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{dailyReport.transactionCount}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Gns. Transaktion</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">
                            {dailyReport.transactionCount > 0
                              ? (dailyReport.totalRevenue / dailyReport.transactionCount).toFixed(2)
                              : 0}{" "}
                            DKK
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tidspunkt</TableHead>
                            <TableHead>Booking nr.</TableHead>
                            <TableHead>Beløb</TableHead>
                            <TableHead>Metode</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dailyReport.payments.map((payment: any) => (
                            <TableRow key={payment.id}>
                              <TableCell>
                                {formatDanishTime(payment.created_at)}
                              </TableCell>
                              <TableCell>{payment.data?.booking_nummer || "-"}</TableCell>
                              <TableCell>{payment.data?.beloeb || "0"} DKK</TableCell>
                              <TableCell>{payment.data?.metode || "N/A"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleSendToAccounting}>
                        <Mail className="mr-2 h-4 w-4" />
                        Send til bogholderi
                      </Button>
                      <Button variant="outline" onClick={() => handleExportExcel("Daglig rapport")}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Excel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sales Report */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Salgsrapport
                </CardTitle>
                <CardDescription>Analyser salg over en periode</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(salesStartDate, "PPP", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={salesStartDate}
                        onSelect={(date) => date && setSalesStartDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">til</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(salesEndDate, "PPP", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={salesEndDate}
                        onSelect={(date) => date && setSalesEndDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button onClick={generateSalesReport} disabled={loading}>
                    Generer rapport
                  </Button>
                </div>

                {salesData && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Omsætning (Periode)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{salesData.totalRevenue.toFixed(2)} DKK</p>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {getDailyRevenueChartData() && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Daglig Omsætning</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Line options={chartOptions} data={getDailyRevenueChartData()!} />
                          </CardContent>
                        </Card>
                      )}
                      {getPackageRevenueChartData() && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Omsætning per Pakke</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Bar options={chartOptions} data={getPackageRevenueChartData()!} />
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <Button variant="outline" onClick={() => handleExportExcel("Salgsrapport")}>
                      <Download className="mr-2 h-4 w-4" />
                      Eksporter til Excel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Consumption Report */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Forbrugsrapport
                </CardTitle>
                <CardDescription>Analyser strømforbrug</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(consumptionStartDate, "PPP", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={consumptionStartDate}
                        onSelect={(date) => date && setConsumptionStartDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">til</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(consumptionEndDate, "PPP", { locale: da })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={consumptionEndDate}
                        onSelect={(date) => date && setConsumptionEndDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button onClick={generateConsumptionReport} disabled={loading}>
                    Generer rapport
                  </Button>
                </div>

                {consumptionData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Total Forbrug</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{consumptionData.totalConsumption} kWh</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Gns. per Kunde</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">
                            {consumptionData.averagePerCustomer.toFixed(1)} kWh
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Antal Pakker</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{consumptionData.packageCount}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {getPeakTimesChartData() && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Peak Forbrugstider</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Bar options={chartOptions} data={getPeakTimesChartData()!} />
                        </CardContent>
                      </Card>
                    )}

                    <Button variant="outline" onClick={() => handleExportExcel("Forbrugsrapport")}>
                      <Download className="mr-2 h-4 w-4" />
                      Eksporter til Excel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Package History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Pakke Historik & Analyse
                </CardTitle>
                <CardDescription>Analyser pakke salg, forbrug og checkout data over tid</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Range Filter */}
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">Fra dato</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !packageHistoryStartDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {packageHistoryStartDate ? format(packageHistoryStartDate, "PPP", { locale: da }) : "Vælg dato"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={packageHistoryStartDate}
                          onSelect={setPackageHistoryStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">Til dato</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !packageHistoryEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {packageHistoryEndDate ? format(packageHistoryEndDate, "PPP", { locale: da }) : "Vælg dato"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={packageHistoryEndDate}
                          onSelect={setPackageHistoryEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button onClick={fetchPackageHistory}>
                    Hent data
                  </Button>
                </div>

                {/* Summary Cards */}
                {packageHistoryData.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Salg</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {packageHistoryData.reduce((sum, d) => sum + parseFloat(d.kwh_sold || '0'), 0).toFixed(0)} kWh
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {packageHistoryData.reduce((sum, d) => sum + (d.packages_sold || 0), 0)} pakker
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Indtjening</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {packageHistoryData.reduce((sum, d) => sum + parseFloat(d.revenue || '0'), 0).toFixed(0)} DKK
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Checkouts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {packageHistoryData.reduce((sum, d) => sum + (d.checkouts_count || 0), 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {packageHistoryData.reduce((sum, d) => sum + parseFloat(d.kwh_forfeited_total || '0'), 0).toFixed(0)} kWh fragivet
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Aktive Pakker</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {packageHistoryData.reduce((sum, d) => sum + (d.active_packages || 0), 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {packageHistoryData.reduce((sum, d) => sum + parseFloat(d.kwh_remaining_total || '0'), 0).toFixed(0)} kWh tilbage
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Data Table */}
                {packageHistoryData.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dato</TableHead>
                          <TableHead>Kunde Type</TableHead>
                          <TableHead>Betaling</TableHead>
                          <TableHead className="text-right">Pakker Solgt</TableHead>
                          <TableHead className="text-right">kWh Solgt</TableHead>
                          <TableHead className="text-right">Indtjening</TableHead>
                          <TableHead className="text-right">Checkouts</TableHead>
                          <TableHead className="text-right">kWh Fragivet</TableHead>
                          <TableHead className="text-right">Aktive</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packageHistoryData.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{format(new Date(row.date), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="capitalize">{row.kunde_type}</TableCell>
                            <TableCell className="capitalize">{row.betalings_metode}</TableCell>
                            <TableCell className="text-right">{row.packages_sold || 0}</TableCell>
                            <TableCell className="text-right">{parseFloat(row.kwh_sold || '0').toFixed(0)}</TableCell>
                            <TableCell className="text-right">{parseFloat(row.revenue || '0').toFixed(0)} DKK</TableCell>
                            <TableCell className="text-right">{row.checkouts_count || 0}</TableCell>
                            <TableCell className="text-right">{parseFloat(row.kwh_forfeited_total || '0').toFixed(1)}</TableCell>
                            <TableCell className="text-right">{row.active_packages || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {packageHistoryData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Vælg datoer og klik "Hent data" for at se pakke historik
                  </div>
                )}
              </CardContent>
            </Card>

          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminRapporter;
