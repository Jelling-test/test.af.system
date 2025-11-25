import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

const AdminPlaceholder = ({ title, description }: PlaceholderPageProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-background flex items-center px-6">
            <SidebarTrigger />
            <h1 className="text-2xl font-bold ml-4">{title}</h1>
          </header>
          <main className="flex-1 p-6 bg-muted/20">
            <Card>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Denne side er under udvikling.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminPlaceholder;
