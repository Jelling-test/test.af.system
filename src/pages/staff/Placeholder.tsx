import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { ArrowLeft, Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

const PlaceholderPage = ({ title, description }: PlaceholderPageProps) => {
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <StaffSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="border-b bg-card h-16 flex items-center px-4 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-bold">{title}</h1>
          </header>

          <main className="flex-1 p-6 flex items-center justify-center">
            <Card className="max-w-md">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Construction className="h-16 w-16 text-muted-foreground" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-6">
                  Denne side er under udvikling
                </p>
                <Button onClick={() => navigate("/staff/dashboard")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Tilbage til dashboard
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default PlaceholderPage;
