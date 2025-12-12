import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, Database, BarChart, Users, Zap, CreditCard, Shield } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const AdminGuide = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Settings,
      title: "System indstillinger",
      description: "Konfigurer campingpladsens grundlæggende indstillinger, priser og integrationer.",
      path: "/admin/indstillinger",
    },
    {
      icon: Users,
      title: "Personale",
      description: "Administrer personale, roller og rettigheder.",
      path: "/admin/personale",
    },
    {
      icon: Database,
      title: "Kunder & bookings",
      description: "Se og administrer alle bookings og kundedata.",
      path: "/admin/kunder",
    },
    {
      icon: Zap,
      title: "Målere",
      description: "Håndter strømmålere, konfiguration og fejlfinding.",
      path: "/admin/maalere",
    },
    {
      icon: CreditCard,
      title: "Priser & produkter",
      description: "Administrer strømpakker og priser i Stripe.",
      path: "/admin/priser",
    },
    {
      icon: BarChart,
      title: "Rapporter",
      description: "Få indsigt i forbrug, indtægter og drift.",
      path: "/admin/rapporter",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/help")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbage til hjælp
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Administrator Guide</h1>
          <p className="text-muted-foreground text-lg">
            Komplet guide til administration af strømstyringssystemet
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System oversigt</CardTitle>
            <CardDescription>Hurtig adgang til alle admin funktioner</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            {sections.map((section) => (
              <div
                key={section.path}
                className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(section.path)}
              >
                <div className="flex items-start gap-3">
                  <section.icon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opsætning & konfiguration</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Måler integration (MQTT)</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>Målere kommunikerer via MQTT:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Målere sender data til MQTT broker</li>
                    <li>Systemet modtager målerdata automatisk</li>
                    <li>Tænd/sluk kommandoer sendes via MQTT</li>
                    <li>Historik gemmes i Supabase database</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Stripe opsætning</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>Stripe er allerede sat op, men for at konfigurere produkter:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Log ind på Stripe dashboard</li>
                    <li>Opret produkter for hver strømpakke (lille, mellem, stor)</li>
                    <li>Kopier produkt-ID'erne</li>
                    <li>Gå til Admin → Priser og opdater produkterne</li>
                    <li>Test en betaling i test-mode først</li>
                    <li>Aktiver live-mode når du er klar</li>
                  </ol>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Webhook secret og API nøgler gemmes sikkert i Lovable Cloud secrets.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Strømmålere</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>For at tilføje eller opdatere målere:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Sørg for at måler er tilsluttet og online</li>
                    <li>Gå til Admin → Målere</li>
                    <li>Klik "Tilføj måler"</li>
                    <li>Indtast pladsnummer og måler-ID</li>
                    <li>Test kommunikationen</li>
                    <li>Aktivér måleren</li>
                  </ol>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Måler-ID skal matche præcist med målerens konfigurerede navn.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Email notifikationer</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>Konfigurer email notifikationer:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Gå til Admin → Indstillinger → Email</li>
                    <li>Indtast SMTP indstillinger (eller brug Resend/SendGrid)</li>
                    <li>Konfigurer admin email og bogholderi email</li>
                    <li>Test email funktionalitet</li>
                    <li>Vælg hvilke events der skal udløse emails</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daglige opgaver</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="task-1">
                <AccordionTrigger>Morgentjek</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Tjek dashboard for anomalier eller fejl</li>
                    <li>Verificer at alle målere rapporterer korrekt</li>
                    <li>Gennemgå nye bookings for dagens check-ins</li>
                    <li>Se om nogen gæster har kørt tør for strøm natten over</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="task-2">
                <AccordionTrigger>Håndtering af support</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Brug kundesøgning til at finde gæstens booking hurtigt</li>
                    <li>Tjek historik for tidligere problemer</li>
                    <li>Verificer målerdata matcher gæstens oplevelse</li>
                    <li>Genaktiver strøm manuelt hvis nødvendigt via admin panel</li>
                    <li>Dokumenter problemer i system notater</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="task-3">
                <AccordionTrigger>Ugentlige opgaver</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Gennemgå indtægtsrapporter for ugen</li>
                    <li>Tjek for målere med usædvanligt forbrug</li>
                    <li>Verificer at cleanup-jobs kører korrekt</li>
                    <li>Backup kritiske data (automatisk via Lovable Cloud)</li>
                    <li>Gennemgå personale aktivitetslog</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader>
            <Shield className="h-8 w-8 text-red-600 mb-2" />
            <CardTitle>Sikkerhed & backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold mb-2">Vigtige sikkerhedsregler:</h4>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <span className="text-red-600">•</span>
                  <span>Del ALDRIG Stripe secret keys eller API tokens</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">•</span>
                  <span>Begræns admin adgang til kun nødvendige personer</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">•</span>
                  <span>Gennemgå personale rettigheder regelmæssigt</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">•</span>
                  <span>Aktiver 2FA på alle kritiske konti (Stripe, Supabase)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">•</span>
                  <span>Lovable Cloud håndterer automatisk database backups</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fejlfinding</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="error-1">
                <AccordionTrigger>Strøm aktiveres ikke efter betaling</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Verificer at betalingen er registreret i Stripe</li>
                    <li>Tjek at MQTT forbindelse er aktiv</li>
                    <li>Se om måler-ID matcher booking</li>
                    <li>Prøv at aktivere strøm manuelt via toggle-power edge function</li>
                    <li>Tjek edge function logs for fejl</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="error-2">
                <AccordionTrigger>Målere viser ikke korrekte data</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Verificer at måler-ID er korrekt</li>
                    <li>Tjek at måler enheden (kWh) er konfigureret rigtigt</li>
                    <li>Se om der er netværksproblemer med måleren</li>
                    <li>Genstart måleren hvis nødvendigt</li>
                    <li>Kontakt leverandør hvis hardware defekt</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="error-3">
                <AccordionTrigger>Betalinger fejler</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Tjek om Stripe er i test-mode vs. live-mode</li>
                    <li>Verificer at webhook secret er korrekt konfigureret</li>
                    <li>Se om produkt-ID'er matcher mellem app og Stripe</li>
                    <li>Tjek edge function logs for create-checkout errors</li>
                    <li>Verificer at Stripe secret key er aktiv og ikke udløbet</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminGuide;
