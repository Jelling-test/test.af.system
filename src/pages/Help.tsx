import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users, UserCog, Shield, ArrowLeft, Zap, CreditCard, BarChart } from "lucide-react";

const Help = () => {
  const navigate = useNavigate();

  const guides = [
    {
      title: "Gæste guide",
      description: "Kom i gang med at købe strøm til dit ophold",
      icon: Users,
      path: "/guide/guest",
      color: "text-blue-600",
    },
    {
      title: "Personale guide",
      description: "Hjælp gæster med check-in og strømstyring",
      icon: UserCog,
      path: "/guide/staff",
      color: "text-green-600",
    },
    {
      title: "Administrator guide",
      description: "Administrer campingpladsen og indstillinger",
      icon: Shield,
      path: "/guide/admin",
      color: "text-purple-600",
    },
  ];

  const quickHelp = [
    {
      title: "Hvordan køber jeg strøm?",
      description: "Log ind med dit bookingsnummer og køb en strømpakke via Stripe.",
      icon: Zap,
    },
    {
      title: "Hvordan fungerer betalingen?",
      description: "Vi bruger Stripe til sikre betalinger. Du kan betale med kort eller MobilePay.",
      icon: CreditCard,
    },
    {
      title: "Hvor ser jeg mit forbrug?",
      description: "På dit dashboard kan du se realtidsdata for dit strømforbrug.",
      icon: BarChart,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbage
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Hjælp & Vejledninger</h1>
          <p className="text-muted-foreground text-lg">
            Find guides og svar på almindelige spørgsmål
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {guides.map((guide) => (
            <Card
              key={guide.path}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(guide.path)}
            >
              <CardHeader>
                <guide.icon className={`h-12 w-12 mb-4 ${guide.color}`} />
                <CardTitle>{guide.title}</CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Hurtig hjælp</CardTitle>
            <CardDescription>Svar på de mest almindelige spørgsmål</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {quickHelp.map((item, index) => (
              <div key={index} className="flex gap-4">
                <item.icon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle>Brug for mere hjælp?</CardTitle>
            <CardDescription>
              Kontakt receptionen på tlf. 8182 6300 - tast 1 eller besøg os personligt
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Help;
