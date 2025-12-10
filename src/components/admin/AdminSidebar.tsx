import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Gauge,
  DollarSign,
  Users,
  FileText,
  UserCog,
  Settings,
  LogOut,
  ShieldCheck,
  Mail,
  Home,
  Radio,
  Map,
  Zap,
  Power,
  CircuitBoard,
  MapPin,
  Smartphone,
  Croissant,
  CalendarDays,
  Ticket,
  Coffee,
  Info,
  Waves,
  TreePine,
  Image,
  ChevronDown,
  ChevronRight,
  MapPinned,
  User,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // Collapsible state for grupper
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    oversigt: true,
    personlig: true,
    salg: true,
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Standalone items øverst
  const topItems = [
    { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Målere", url: "/admin/maalere", icon: Gauge },
    { title: "Hytter", url: "/admin/hytter", icon: Home },
  ];

  // Oversigts kort gruppe
  const oversigtItems = [
    { title: "Parring", url: "/admin/parring", icon: Radio },
    { title: "Kort", url: "/admin/kort", icon: Map },
    { title: "Standere", url: "/admin/standere", icon: Zap },
    { title: "El-infrastruktur", url: "/admin/el-infrastruktur", icon: CircuitBoard },
    { title: "Pladser", url: "/admin/pladser", icon: MapPin },
  ];

  // Personlige Sider gruppe
  const personligItems = [
    { title: "Personlig Side", url: "/admin/personlig-side", icon: Smartphone },
    { title: "Dashboard Billeder", url: "/admin/dashboard-billeder", icon: Image },
    { title: "Events", url: "/admin/events", icon: CalendarDays },
    { title: "Externe Events", url: "/admin/eksterne-events", icon: Ticket },
    { title: "Attraktioner", url: "/admin/attraktioner", icon: MapPin },
    { title: "Praktisk Info", url: "/admin/praktisk", icon: Info },
    { title: "Friluftsbad", url: "/admin/friluftsbad", icon: Waves },
    { title: "Legeplads", url: "/admin/legeplads", icon: TreePine },
    { title: "Hytter - Info", url: "/admin/hytter-info", icon: Home },
  ];

  // Salg gruppe
  const salgItems = [
    { title: "Bageri", url: "/admin/bageri", icon: Croissant },
    { title: "Café", url: "/admin/cafe", icon: Coffee },
  ];

  // Standalone items nederst
  const bottomItems = [
    { title: "Priser", url: "/admin/priser", icon: DollarSign },
    { title: "Kunder", url: "/admin/kunder", icon: Users },
    { title: "Manuel Tænd", url: "/admin/manuel-taend", icon: Power },
    { title: "Bomstyring", url: "/admin/bom", icon: ShieldCheck },
    { title: "Gruppe Mails", url: "/admin/gruppe-mails", icon: Mail },
    { title: "Rapporter", url: "/admin/rapporter", icon: FileText },
    { title: "Personale", url: "/admin/personale", icon: UserCog },
    { title: "Indstillinger", url: "/admin/indstillinger", icon: Settings },
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Fejl ved logout");
    } else {
      toast.success("Du er nu logget ud");
      navigate("/admin/login");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const getNavCls = (path: string) =>
    isActive(path)
      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
      : "hover:bg-accent hover:text-accent-foreground";

  const renderMenuItems = (items: typeof topItems) => (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            onClick={() => navigate(item.url)}
            className={getNavCls(item.url)}
            tooltip={collapsed ? item.title : undefined}
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );

  const renderCollapsibleGroup = (
    groupKey: string,
    label: string,
    icon: React.ReactNode,
    items: typeof topItems
  ) => (
    <div className="mb-1">
      <button
        onClick={() => toggleGroup(groupKey)}
        className="flex items-center w-full px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-accent rounded-md transition-colors"
      >
        {icon}
        {!collapsed && (
          <>
            <span className="ml-2 flex-1 text-left">{label}</span>
            {openGroups[groupKey] ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </>
        )}
      </button>
      {(openGroups[groupKey] || collapsed) && (
        <SidebarMenu className={collapsed ? "" : "ml-4 border-l border-border pl-2"}>
          {renderMenuItems(items)}
        </SidebarMenu>
      )}
    </div>
  );

  return (
    <Sidebar className="border-r bg-sidebar" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground">
            {!collapsed && "Admin Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {/* Standalone øverst */}
            <SidebarMenu>
              {renderMenuItems(topItems)}
            </SidebarMenu>

            {/* Oversigts kort gruppe */}
            {renderCollapsibleGroup(
              "oversigt",
              "Oversigts kort",
              <MapPinned className="h-4 w-4" />,
              oversigtItems
            )}

            {/* Personlige Sider gruppe */}
            {renderCollapsibleGroup(
              "personlig",
              "Personlige Sider",
              <User className="h-4 w-4" />,
              personligItems
            )}

            {/* Salg gruppe */}
            {renderCollapsibleGroup(
              "salg",
              "Salg",
              <ShoppingBag className="h-4 w-4" />,
              salgItems
            )}

            {/* Standalone nederst */}
            <SidebarMenu>
              {renderMenuItems(bottomItems)}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
                  className="hover:bg-destructive hover:text-destructive-foreground"
                  tooltip={collapsed ? "Log ud" : undefined}
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Log ud</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;
