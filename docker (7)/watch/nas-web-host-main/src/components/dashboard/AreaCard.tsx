import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Square, Activity, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface AreaCardProps {
  area: {
    id: string;
    name: string;
    mqtt_topic: string;
    deviceCount: number;
    devicesOnline?: number;
    devicesOffline?: number;
    status?: string;
  };
  onStartTest: (areaId: string) => void;
  onStopTest: (areaId: string) => void;
  onStartMonitoring: (areaId: string) => void;
  onStopMonitoring: (areaId: string) => void;
  onViewResults: (areaId: string) => void;
}

const getStatusColor = (status?: string) => {
  const safeStatus = status || "idle";
  const statusMap: Record<string, string> = {
    idle: "bg-muted text-muted-foreground",
    test_running: "bg-info text-info-foreground",
    monitoring: "bg-success text-success-foreground",
    device_joined: "bg-warning text-warning-foreground",
    interview_ok: "bg-success text-success-foreground",
    interview_failed: "bg-destructive text-destructive-foreground",
  };
  return statusMap[safeStatus] || "bg-muted text-muted-foreground";
};

const formatStatus = (status?: string) => {
  if (!status) return "Idle";
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const AreaCard = ({ area, onStartTest, onStopTest, onStartMonitoring, onStopMonitoring, onViewResults }: AreaCardProps) => {
  const isTestRunning = area.status === 'test_running';
  const isMonitoring = area.status === 'monitoring';

  return (
    <Card className="p-6 transition-shadow hover:shadow-md">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{area.name}</h3>
            <p className="text-sm text-muted-foreground font-mono">{area.mqtt_topic}</p>
          </div>
          <Badge className={cn("capitalize", getStatusColor(area.status))}>
            {formatStatus(area.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>
            {area.deviceCount} devices
            {area.devicesOnline !== undefined && area.devicesOffline !== undefined && (
              <span className="text-xs ml-1">
                ({area.devicesOnline} online - {area.devicesOffline} offline)
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!isTestRunning && !isMonitoring && (
            <Button
              onClick={() => onStartTest(area.id)}
              size="sm"
              variant="default"
              className="w-full"
            >
              <Play className="h-4 w-4 mr-1" />
              Start Test
            </Button>
          )}
          
          {isTestRunning && (
            <Button
              onClick={() => onStopTest(area.id)}
              size="sm"
              variant="destructive"
              className="w-full"
            >
              <Square className="h-4 w-4 mr-1" />
              Stop Test
            </Button>
          )}

          {!isTestRunning && !isMonitoring && (
            <Button
              onClick={() => onStartMonitoring(area.id)}
              size="sm"
              variant="outline"
              className="w-full"
            >
              <Activity className="h-4 w-4 mr-1" />
              Monitor 12h
            </Button>
          )}

          {isMonitoring && (
            <Button
              onClick={() => onStopMonitoring(area.id)}
              size="sm"
              variant="destructive"
              className="w-full"
            >
              <Square className="h-4 w-4 mr-1" />
              Stop Monitor
            </Button>
          )}

          <Button
            onClick={() => onViewResults(area.id)}
            size="sm"
            variant="secondary"
            className="w-full"
          >
            <Eye className="h-4 w-4 mr-1" />
            View Results
          </Button>
        </div>
      </div>
    </Card>
  );
};
