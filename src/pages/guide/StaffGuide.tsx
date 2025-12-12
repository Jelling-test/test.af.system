import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserCheck, Package, Zap, AlertTriangle, BarChart, Users } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const StaffGuide = () => {
  const navigate = useNavigate();

  const workflows = [
    {
      icon: UserCheck,
      title: "Check-in gæster",
      steps: [
        "Log ind på personale-portalen",
        "Scan eller indtast gæstens bookingsnummer",
        "Verificer gæstedata og pladsnummer",
        "Tildel strømpakke hvis ønsket",
        "Gennemfør check-in",
      ],
    },
    {
      icon: Package,
      title: "Tildel strømpakke",
      steps: [
        "Find gæsten via check-in eller søgning",
        "Vælg passende pakke (lille/mellem/stor)",
        "Bekræft tildeling",
        "Strøm aktiveres automatisk",
        "Giv kvittering til gæst",
      ],
    },
    {
      icon: Zap,
      title: "Håndter strømproblemer",
      steps: [
        "Verificer om gæsten har aktiv pakke",
        "Tjek forbrug og resterende enheder",
        "Genaktiver strøm hvis nødvendigt",
        "Hjælp med køb af ny pakke",
        "Kontakt admin ved tekniske problemer",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/help")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbage til hjælp
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Personale Guide</h1>
          <p className="text-muted-foreground text-lg">
            Guide til daglige opgaver og workflows
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daglige workflows</CardTitle>
            <CardDescription>Almindelige opgaver du vil udføre</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {workflows.map((workflow, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center gap-3">
                  <workflow.icon className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold text-lg">{workflow.title}</h3>
                </div>
                <ol className="list-decimal pl-8 space-y-1 text-muted-foreground">
                  {workflow.steps.map((step, stepIndex) => (
                    <li key={stepIndex}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ofte stillede spørgsmål fra gæster</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>"Min strøm virker ikke?"</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Tjek om gæsten har en aktiv strømpakke</li>
                    <li>Se om de har enheder tilbage</li>
                    <li>Verificer at måler-ID matcher deres plads</li>
                    <li>Prøv at genaktivere via admin panel</li>
                    <li>Kontakt admin hvis problemet fortsætter</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>"Hvor meget strøm skal jeg købe?"</AccordionTrigger>
                <AccordionContent>
                  Anbefal baseret på opholdets længde og behov:
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>1-2 dage, minimalt forbrug:</strong> Lille pakke (50 enheder)</li>
                    <li><strong>3-5 dage, normalt forbrug:</strong> Mellem pakke (100 enheder)</li>
                    <li><strong>Uge+, højt forbrug:</strong> Stor pakke (200 enheder)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>"Kan jeg få refunderet ubrugt strøm?"</AccordionTrigger>
                <AccordionContent>
                  Nej, strømpakkerne er ikke refunderbare. Dette er fast politik.
                  Hjælp i stedet gæsten med at vælge den rigtige pakkestørrelse fra starten.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>"Hvordan logger jeg ind?"</AccordionTrigger>
                <AccordionContent>
                  Gæster skal bruge deres bookingsnummer og efternavn.
                  Find bookingsnummeret i deres bookingbekræftelse eller i campingens system.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <AlertTriangle className="h-8 w-8 text-yellow-600 mb-2" />
            <CardTitle>Hvornår skal jeg kontakte admin?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-yellow-600">•</span>
                <span>Tekniske problemer med måler-integration</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-600">•</span>
                <span>Stripe betalinger virker ikke</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-600">•</span>
                <span>Målere viser forkerte data</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-600">•</span>
                <span>System er nede eller meget langsomt</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-600">•</span>
                <span>Gæst rapporterer betalingsproblemer</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <BarChart className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Adgang til rapporter</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Som personale har du begrænset adgang til rapporter:</p>
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-green-600">✓</span>
                <span>Se gæsters aktive bookings og forbrug</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">✓</span>
                <span>Check-in oversigt for i dag</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-600">✗</span>
                <span>Økonomiske rapporter (kun admin)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-600">✗</span>
                <span>Historiske data ældre end 30 dage (kun admin)</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffGuide;
