import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DoorOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function RemoteGate() {
  const [isOpening, setIsOpening] = useState(false);

  const openGate = async () => {
    setIsOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('gate-open', {
        body: { source: 'remote_control' }
      });

      if (error) throw error;

      toast.success('Bommen åbnes nu!');
    } catch (error) {
      console.error('Error opening gate:', error);
      toast.error('Kunne ikke åbne bommen');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <DoorOpen className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Fjernbetjening</CardTitle>
          <CardDescription>Åbn bommen fra hvor som helst</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={openGate}
            disabled={isOpening}
            size="lg"
            className="w-full h-20 text-xl"
          >
            {isOpening ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Åbner...
              </>
            ) : (
              <>
                <DoorOpen className="mr-2 h-6 w-6" />
                Åbn bommen
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>Bommen åbner i 10 sekunder</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
