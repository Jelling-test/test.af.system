import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface CameraFeedProps {
  cameraSerial: string;
  title?: string;
}

export function CameraFeed({ cameraSerial, title = "Live Kamera" }: CameraFeedProps) {
  const [imageError, setImageError] = useState(false);
  
  // Proxy URL to avoid exposing credentials in browser
  // Dev-proxy i Vite servicer et statisk snapshot-endpoint
  const streamUrl = `/api/camera-feed`;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {!imageError ? (
            <img
              src={streamUrl}
              alt="Live kamera feed"
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <img
              src="/placeholder.svg"
              alt="Kamera placeholder"
              className="w-full h-full object-cover opacity-80"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
