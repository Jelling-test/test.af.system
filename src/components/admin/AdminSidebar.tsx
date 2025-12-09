import { useNavigate, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const menuItems = [
    { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Målere", url: "/admin/maalere", icon: Gauge },
    { title: "Parring", url: "/admin/parring", icon: Radio },
    { title: "Kort", url: "/admin/kort", icon: Map },
    { title: "Standere", url: "/admin/standere", icon: Zap },
    { title: "El-infrastruktur", url: "/admin/el-infrastruktur", icon: CircuitBoard },
    { title: "Pladser", url: "/admin/pladser", icon: MapPin },
    { title: "Hytter", url: "/admin/hytter", icon: Home },
    { title: "Personlig Side", url: "/admin/personlig-side", icon: Smartphone },
    { title: "Bageri", url: "/admin/bageri", icon: Croissant },
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

  return (
    <Sidebar className="border-r bg-sidebar" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground">
            {!collapsed && "Admin Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
