import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { toast } from "sonner";
import {
  Gauge,
  Package,
  DollarSign,
  TrendingUp,
  Wifi,
  Lock,
  MoveHorizontal,
  ShoppingCart,
  AlertTriangle,
  Mail,
  XCircle,
  Power,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface AdminDashboardProps {
  isStaffView?: boolean;
}

const AdminDashboard = ({ isStaffView = false }: AdminDashboardProps = {}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMeters: 0,
    activePackages: 0,
    onlineMeters: 0,
    occupiedMeters: 0,
    totalWatt: 0,
    totalAmpere: 0,
    maxWatt24h: 0,
    maxAmpere24h: 0,
    todayRevenue: 0,
    monthRevenue: 0,
  });
  const [revenueData, setRevenueData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!isStaffView) {
      checkAdminAccess();
    }
    fetchDashboardData();
  }, [isStaffView]);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/admin/login");
      return;
    }

    // Get user membership
    const { data: membershipData, error: membershipError } = await (supabase as any)
      .from("user_memberships")
      .select("role_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membershipData) {
      toast.error("Ingen administrator adgang");
      navigate("/admin/login");
      return;
    }

    // Get role name
    const { data: roleData, error: roleError } = await (supabase as any)
      .from("roles")
      .select("name")
      .eq("id", (membershipData as any).role_id)
      .single();

    if (roleError || !roleData) {
      toast.error("Ingen administrator adgang");
      navigate("/admin/login");
      return;
    }

    const roleName = (roleData as any).name;
    if (roleName !== "admin" && roleName !== "superadmin") {
      toast.error("Ingen administrator adgang");
      navigate("/admin/login");
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch total meters from power_meters table
      const { count: metersCount } = await (supabase as any)
        .from("power_meters")
        .select("*", { count: "exact", head: true });

      // Fetch online meters (readings within last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: onlineMetersData } = await (supabase as any)
        .from("meter_readings")
        .select("meter_id")
        .gte("time", fiveMinutesAgo);
      
      const uniqueOnlineMeters = new Set(onlineMetersData?.map((r: any) => r.meter_id) || []);
      const onlineCount = uniqueOnlineMeters.size;

      // Fetch occupied meters (dynamisk beregning baseret på tildelte målere)
      const { data: regularCustomersWithMeters } = await (supabase as any)
        .from("regular_customers")
        .select("meter_id", { count: "exact" })
        .not("meter_id", "is", null);

      const { data: seasonalCustomersWithMeters } = await (supabase as any)
        .from("seasonal_customers")
        .select("meter_id", { count: "exact" })
        .not("meter_id", "is", null);

      const occupiedCount = (regularCustomersWithMeters?.length || 0) + (seasonalCustomersWithMeters?.length || 0);

      // Fetch current power consumption (total W and A from all online meters)
      const { data: powerData } = await (supabase as any)
        .rpc('get_total_power_consumption');
      
      const totalWatt = powerData?.[0]?.total_watt || 0;
      const totalAmpere = powerData?.[0]?.total_ampere || 0;

      // Fetch max power consumption in last 24 hours
      const { data: maxPowerData } = await (supabase as any)
        .from('meter_readings')
        .select('power, current')
        .gte('time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('power', { ascending: false })
        .limit(1)
        .single();

      const { data: maxCurrentData } = await (supabase as any)
        .from('meter_readings')
        .select('current')
        .gte('time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('current', { ascending: false })
        .limit(1)
        .single();

      const maxWatt24h = maxPowerData?.power || 0;
      const maxAmpere24h = maxCurrentData?.current || 0;

      // Fetch active packages
      const { count: packagesCount } = await (supabase as any)
        .from("plugin_data")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakker")
        .filter("data->>status", "eq", "aktiv");

      // Fetch today's revenue
      const today = new Date().toISOString().split("T")[0];
      const { data: todayPayments } = await (supabase as any)
        .from("plugin_data")
        .select("data")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "betalinger")
        .gte("created_at", today);

      const todayRev = todayPayments?.reduce((sum: number, p: any) => {
        const amount = p.data?.beloeb || 0;
        return sum + parseFloat(amount);
      }, 0) || 0;

      // Fetch month's revenue
      const monthStart = new Date();
      monthStart.setDate(1);
      const { data: monthPayments } = await (supabase as any)
        .from("plugin_data")
        .select("data")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "betalinger")
        .gte("created_at", monthStart.toISOString());

      const monthRev = monthPayments?.reduce((sum: number, p: any) => {
        const amount = p.data?.beloeb || 0;
        return sum + parseFloat(amount);
      }, 0) || 0;

      // Fetch last 30 days revenue for chart
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: revenuePayments } = await (supabase as any)
        .from("plugin_data")
        .select("data, created_at")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "betalinger")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      // Process revenue data for chart
      const dailyRevenue: { [key: string]: number } = {};
      revenuePayments?.forEach((payment) => {
        const date = new Date(payment.created_at).toISOString().split("T")[0];
        const amount = parseFloat(payment.data?.beloeb || "0");
        dailyRevenue[date] = (dailyRevenue[date] || 0) + amount;
      });

      const labels = Object.keys(dailyRevenue).sort();
      const data = labels.map((date) => dailyRevenue[date]);

      setRevenueData({
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
      });

      // Fetch recent activity - combine meter moves, package purchases, and warnings
      const activities: any[] = [];

      // 1. Fetch meter moves (3 latest)
      const { data: meterMoves } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "audit_log")
        .eq("data->>action", "move_meter")
        .order("created_at", { ascending: false })
        .limit(3);

      // Fetch customer names for meter moves
      for (const move of meterMoves || []) {
        const bookingId = move.data?.booking_nummer;
        let customerName = "N/A";
        
        if (bookingId) {
          const { data: seasonalCustomer } = await (supabase as any)
            .from("seasonal_customers")
            .select("first_name, last_name")
            .eq("booking_id", bookingId)
            .maybeSingle();
          
          if (seasonalCustomer) {
            customerName = `${seasonalCustomer.first_name} ${seasonalCustomer.last_name || ''}`.trim();
          } else {
            const { data: regularCustomer } = await (supabase as any)
              .from("regular_customers")
              .select("first_name, last_name")
              .eq("booking_id", bookingId)
              .maybeSingle();
            
            if (regularCustomer) {
              customerName = `${regularCustomer.first_name} ${regularCustomer.last_name || ''}`.trim();
            }
          }
        }

        const performedBy = move.data?.performed_by || "admin";
        activities.push({
          type: "meter_move",
          title: "Måler skift",
          description: `${performedBy.charAt(0).toUpperCase() + performedBy.slice(1)} skiftede måler for kunde`,
          bookingId: bookingId,
          customerName: customerName,
          time: move.created_at,
        });
      }

      // 2. Fetch package purchases (4 latest)
      const { data: packagePurchases } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "pakker")
        .order("created_at", { ascending: false })
        .limit(4);

      // Fetch customer names for package purchases
      for (const pkg of packagePurchases || []) {
        const bookingId = pkg.data?.booking_nummer;
        let customerName = "N/A";
        
        if (bookingId) {
          const { data: seasonalCustomer } = await (supabase as any)
            .from("seasonal_customers")
            .select("first_name, last_name")
            .eq("booking_id", bookingId)
            .maybeSingle();
          
          if (seasonalCustomer) {
            customerName = `${seasonalCustomer.first_name} ${seasonalCustomer.last_name || ''}`.trim();
          } else {
            const { data: regularCustomer } = await (supabase as any)
              .from("regular_customers")
              .select("first_name, last_name")
              .eq("booking_id", bookingId)
              .maybeSingle();
            
            if (regularCustomer) {
              customerName = `${regularCustomer.first_name} ${regularCustomer.last_name || ''}`.trim();
            }
          }
        }

        const betalingMetode = pkg.data?.betaling_metode || 'ukendt';
        const betalingText = betalingMetode === 'stripe' 
          ? 'via Stripe' 
          : betalingMetode === 'reception' 
            ? 'af admin/staff' 
            : '';

        activities.push({
          type: "package_purchase",
          title: "Pakke køb",
          description: `Kunde købte ${pkg.data?.pakke_navn || 'N/A'} ${betalingText}`,
          bookingId: bookingId,
          customerName: customerName,
          time: pkg.created_at,
        });
      }

      // 3. Fetch offline meters (3 latest) - same logic as Maalere page
      // Get latest reading for each meter
      const { data: allLatestReadings } = await (supabase as any)
        .rpc('get_latest_meter_readings');

      // Filter to only offline meters (no reading in last 2 minutes - same as Maalere page)
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      const offlineMeters = allLatestReadings
        ?.filter((reading: any) => new Date(reading.last_reading).getTime() <= twoMinutesAgo)
        .sort((a: any, b: any) => new Date(b.last_reading).getTime() - new Date(a.last_reading).getTime())
        .slice(0, 3) || [];

      offlineMeters.forEach((meter: any) => {
        activities.push({
          type: "warning",
          title: "Måler offline",
          description: `Måler ${meter.meter_id} er offline`,
          time: meter.last_reading,
        });
      });

      // 4. Fetch warning emails sent (3 latest)
      const { data: warningEmails } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "email_log")
        .eq("data->>email_type", "advarsel")
        .order("created_at", { ascending: false })
        .limit(3);

      for (const email of warningEmails || []) {
        const bookingId = email.data?.booking_nummer;
        let customerName = "N/A";
        
        if (bookingId) {
          const { data: seasonalCustomer } = await (supabase as any)
            .from("seasonal_customers")
            .select("first_name, last_name")
            .eq("booking_id", bookingId)
            .maybeSingle();
          
          if (seasonalCustomer) {
            customerName = `${seasonalCustomer.first_name} ${seasonalCustomer.last_name || ''}`.trim();
          } else {
            const { data: regularCustomer } = await (supabase as any)
              .from("regular_customers")
              .select("first_name, last_name")
              .eq("booking_id", bookingId)
              .maybeSingle();
            
            if (regularCustomer) {
              customerName = `${regularCustomer.first_name} ${regularCustomer.last_name || ''}`.trim();
            }
          }
        }

        const enhederTilbage = email.data?.enheder_tilbage || 'N/A';
        activities.push({
          type: "warning_email",
          title: "Advarsel sendt",
          description: `Email sendt til kunde - ${enhederTilbage} enheder tilbage`,
          bookingId: bookingId,
          customerName: customerName,
          time: email.created_at,
        });
      }

      // 5. Fetch email errors (3 latest)
      const { data: emailErrors } = await (supabase as any)
        .from("plugin_data")
        .select("*")
        .eq("organization_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        .eq("module", "email_errors")
        .order("created_at", { ascending: false })
        .limit(3);

      for (const error of emailErrors || []) {
        const bookingId = error.data?.booking_nummer;
        let customerName = "N/A";
        
        if (bookingId) {
          const { data: seasonalCustomer } = await (supabase as any)
            .from("seasonal_customers")
            .select("first_name, last_name")
            .eq("booking_id", bookingId)
            .maybeSingle();
          
          if (seasonalCustomer) {
            customerName = `${seasonalCustomer.first_name} ${seasonalCustomer.last_name || ''}`.trim();
          } else {
            const { data: regularCustomer } = await (supabase as any)
              .from("regular_customers")
              .select("first_name, last_name")
              .eq("booking_id", bookingId)
              .maybeSingle();
            
            if (regularCustomer) {
              customerName = `${regularCustomer.first_name} ${regularCustomer.last_name || ''}`.trim();
            }
          }
        }

        const errorReason = error.data?.error_reason || 'Ukendt fejl';
        activities.push({
          type: "email_error",
          title: "Email fejl",
          description: `${errorReason}`,
          bookingId: bookingId,
          customerName: customerName,
          time: error.created_at,
        });
      }

      // Meter shutoff logs fjernet - bruges ikke længere

      setStats({
        totalMeters: metersCount || 0,
        activePackages: packagesCount || 0,
        onlineMeters: onlineCount,
        occupiedMeters: occupiedCount || 0,
        totalWatt: totalWatt,
        totalAmpere: totalAmpere,
        maxWatt24h: maxWatt24h,
        maxAmpere24h: maxAmpere24h,
        todayRevenue: todayRev,
        monthRevenue: monthRev,
      });

      // Group activities by type and keep them separate (don't mix)
      const meterMoveActivities = activities.filter(a => a.type === "meter_move").slice(0, 3);
      const packagePurchaseActivities = activities.filter(a => a.type === "package_purchase").slice(0, 4);
      const warningActivities = activities.filter(a => a.type === "warning").slice(0, 3);
      const warningEmailActivities = activities.filter(a => a.type === "warning_email").slice(0, 3);
      const emailErrorActivities = activities.filter(a => a.type === "email_error").slice(0, 3);

      // Combine in order: meter moves, package purchases, warnings, warning emails, email errors
      const sortedActivities = [
        ...meterMoveActivities, 
        ...packagePurchaseActivities, 
        ...warningActivities,
        ...warningEmailActivities,
        ...emailErrorActivities
      ];
      setRecentActivity(sortedActivities);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Fejl ved hentning af data");
      setLoading(false);
    }
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Omsætning - Sidste 30 dage",
      },
    },
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
      <div className="min-h-screen flex w-full">
        {isStaffView ? <StaffSidebar /> : <AdminSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-background flex items-center px-6">
            <SidebarTrigger />
            <h1 className="text-2xl font-bold ml-4">{isStaffView ? 'Dashboard' : 'Administrator Dashboard'}</h1>
          </header>
          <main className="flex-1 p-6 bg-muted/20">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Målere</CardTitle>
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalMeters}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Online Målere</CardTitle>
                  <Wifi className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.onlineMeters}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Optaget Målere</CardTitle>
                  <Lock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.occupiedMeters}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktive Pakker</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activePackages}</div>
                </CardContent>
              </Card>
              {!isStaffView && (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Dagens Omsætning</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.todayRevenue.toFixed(2)} DKK</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Månedens Omsætning</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.monthRevenue.toFixed(2)} DKK</div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Seneste Aktivitet */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Seneste Aktivitet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen aktivitet endnu</p>
                  ) : (
                    recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start gap-3 border-b pb-3 last:border-0">
                        <div className="mt-1">
                          {activity.type === "meter_move" && (
                            <MoveHorizontal className="h-5 w-5 text-blue-500" />
                          )}
                          {activity.type === "package_purchase" && (
                            <ShoppingCart className="h-5 w-5 text-green-500" />
                          )}
                          {activity.type === "warning" && (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          )}
                          {activity.type === "warning_email" && (
                            <Mail className="h-5 w-5 text-orange-500" />
                          )}
                          {activity.type === "email_error" && (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{activity.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.description}{" "}
                            {activity.bookingId && (
                              <>
                                <button
                                  onClick={() => navigate(`/admin/kunder?booking=${activity.bookingId}`)}
                                  className="text-blue-600 hover:underline font-medium"
                                  title="Klik for at åbne kunde"
                                >
                                  #{activity.bookingId}
                                </button>
                                {activity.customerName && activity.customerName !== "N/A" && (
                                  <span> ({activity.customerName})</span>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(activity.time).toLocaleString("da-DK", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Aktuelt Forbrug */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktuelt Forbrug (W)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalWatt.toFixed(0)} W</div>
                  <p className="text-xs text-muted-foreground">Samlet effekt fra alle online målere</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktuelt Forbrug (A)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAmpere.toFixed(2)} A</div>
                  <p className="text-xs text-muted-foreground">Samlet strøm fra alle online målere</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Højeste Forbrug 24h (W)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.maxWatt24h.toFixed(0)} W</div>
                  <p className="text-xs text-muted-foreground">Højeste målt effekt sidste 24 timer</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Højeste Forbrug 24h (A)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.maxAmpere24h.toFixed(2)} A</div>
                  <p className="text-xs text-muted-foreground">Højeste målt strøm sidste 24 timer</p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
