import { Activity, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface StatusIndicatorProps {
  isConnected: boolean;
  activeTests: number;
  activeSessions: number;
}

export const StatusIndicator = ({ isConnected, activeTests, activeSessions }: StatusIndicatorProps) => {
  return (
    <Card className="p-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-5 w-5 text-success" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
          <span className="text-sm font-medium text-foreground">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {activeTests > 0 && (
            <Badge variant="secondary" className="bg-info text-info-foreground">
              <Activity className="h-3 w-3 mr-1" />
              {activeTests} Active Test{activeTests !== 1 ? 's' : ''}
            </Badge>
          )}
          {activeSessions > 0 && (
            <Badge variant="secondary" className="bg-success text-success-foreground">
              <Activity className="h-3 w-3 mr-1" />
              {activeSessions} Monitoring Session{activeSessions !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};
