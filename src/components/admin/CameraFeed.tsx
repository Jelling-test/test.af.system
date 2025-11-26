import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface CameraFeedProps {
  cameraSerial: string;
  title?: string;
  refreshInterval?: number; // milliseconds
}

export function CameraFeed({ cameraSerial, title = "Live Kamera", refreshInterval = 2000 }: CameraFeedProps) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const fetchSnapshot = useCallback(async () => {
    try {
      // Hent brugerens session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('Ikke logget ind - kan ikke hente kamera');
        setImageError(true);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-snapshot`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Ryd op i gammel URL
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      
      setImageUrl(url);
      setImageError(false);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Fejl ved hentning af kamera snapshot:', error);
      setImageError(true);
    } finally {
      setLoading(false);
    }
  }, [imageUrl]);
  
  useEffect(() => {
    // Hent første snapshot
    fetchSnapshot();
    
    // Auto-refresh
    const interval = setInterval(fetchSnapshot, refreshInterval);
    
    return () => {
      clearInterval(interval);
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [refreshInterval]);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{title}</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchSnapshot}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {loading && !imageUrl ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : imageError || !imageUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-2" />
              <p className="text-sm">Kunne ikke indlæse kamera</p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="Live kamera feed"
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          )}
        </div>
        {lastUpdate && (
          <p className="text-xs text-muted-foreground mt-2">
            Sidst opdateret: {lastUpdate.toLocaleTimeString('da-DK')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
