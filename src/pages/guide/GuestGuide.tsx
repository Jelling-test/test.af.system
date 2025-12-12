import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, Package, Zap, CreditCard, BarChart, Power } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const GuestGuide = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: LogIn,
      title: "Log ind",
      description: "Brug dit bookingsnummer og efternavn for at logge ind på portalen.",
    },
    {
      icon: Package,
      title: "Vælg pakke",
      description: "Vælg mellem lille, mellem eller stor strømpakke baseret på dit behov.",
    },
    {
      icon: CreditCard,
      title: "Betal sikkert",
      description: "Gennemfør betalingen via Stripe med kort eller MobilePay.",
    },
    {
      icon: Zap,
      title: "Strøm aktiveres",
      description: "Din strøm aktiveres automatisk efter betaling.",
    },
    {
      icon: BarChart,
      title: "Følg forbrug",
      description: "Se dit realtidsforbrug på dashboardet og køb mere hvis nødvendigt.",
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
          <h1 className="text-4xl font-bold">Gæste Guide</h1>
          <p className="text-muted-foreground text-lg">
            Sådan kommer du i gang med strøm på Jelling Camping
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Trin-for-trin guide</CardTitle>
            <CardDescription>Følg disse simple trin for at købe strøm</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-muted-foreground">Trin {index + 1}</span>
                  </div>
                  <h3 className="font-semibold mb-1">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ofte stillede spørgsmål</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Hvad er mit bookingsnummer?</AccordionTrigger>
                <AccordionContent>
                  Dit bookingsnummer finder du i din bookingbekræftelse fra Jelling Camping.
                  Det er typisk et 6-cifret nummer.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Hvilken pakke skal jeg vælge?</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Lille (50 enheder):</strong> Perfekt til kun lys og lidt mobil-opladning</li>
                    <li><strong>Mellem (100 enheder):</strong> Til almindelig brug med køleskab og elektronik</li>
                    <li><strong>Stor (200 enheder):</strong> Til større forbrug med varmeapparat eller klimaanlæg</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Hvad sker der hvis jeg løber tør for strøm?</AccordionTrigger>
                <AccordionContent>
                  Når du løber tør for strøm, vil din forsyning blive afbrudt automatisk.
                  Du kan købe en ny pakke med det samme fra dashboardet, og strømmen aktiveres igen.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Kan jeg få refunderet ubrugt strøm?</AccordionTrigger>
                <AccordionContent>
                  Nej, ubrugt strøm kan desværre ikke refunderes. Vælg derfor en passende pakke
                  baseret på dit forventede forbrug. Du kan altid købe mere hvis nødvendigt.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>Er betalingen sikker?</AccordionTrigger>
                <AccordionContent>
                  Ja, alle betalinger håndteres via Stripe, som er en af verdens mest sikre
                  betalingsudbydere. Vi gemmer ikke dine kortoplysninger.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <Power className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Tips til at spare strøm</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Sluk elektronik når den ikke er i brug</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Brug LED pærer i stedet for gamle lyspærer</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Hold køleskabsdøren lukket mest muligt</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Varm vand op på gasblusset i stedet for el-kedel</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuestGuide;
