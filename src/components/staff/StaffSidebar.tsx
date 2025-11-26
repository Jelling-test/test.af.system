import { 
  LayoutDashboard, 
  Package, 
  Zap,
  LogOut,
  ShieldCheck,
  Home,
} from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const menuItems = [
  { title: "Dashboard", url: "/staff/dashboard", icon: LayoutDashboard },
  { title: "Kunde detaljer", url: "/staff/kunde-detaljer", icon: Package },
  { title: "Hytter", url: "/staff/hytter", icon: Home },
  { title: "Bomstyring", url: "/staff/bom", icon: ShieldCheck },
  { title: "Se alle målere", url: "/staff/maalere", icon: Zap },
];

export function StaffSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Fejl ved logout");
    } else {
      toast.success("Du er nu logget ud");
      navigate("/staff/login");
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
            {!collapsed && "Personale Navigation"}
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
}
