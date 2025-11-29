import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MeterData {
  meterName: string;
  messageCount: number;
  avgLqi: number;
  stateChanges: number;
  gapCount: number;
  maxGapMs: number;
}

interface TestResult {
  area: {
    id: string;
    name: string;
    deviceCount?: number;
    devicesOnline?: number;
    devicesOffline?: number;
  };
  startedAt: string;
  durationSeconds: number;
  active: boolean;
  meters: MeterData[];
}

interface TestResultsPanelProps {
  result: TestResult | null;
  onDownloadCSV: () => void;
}

export const TestResultsPanel = ({ result, onDownloadCSV }: TestResultsPanelProps) => {
  if (!result) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <p>No test results to display</p>
          <p className="text-sm mt-2">Start a test to see results here</p>
        </div>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">{result.area.name}</h2>
            <p className="text-sm text-muted-foreground">Test Results</p>
            {result.area.deviceCount !== undefined && (
              <p className="text-sm font-medium text-foreground">
                {result.area.deviceCount} devices total 
                {result.meters.length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}({result.meters.length} reporting
                    {result.area.deviceCount > result.meters.length && 
                      ` - ${result.area.deviceCount - result.meters.length} offline`})
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {result.active
                ? `Test kører – data opdateres automatisk`
                : `Test er afsluttet – seneste resultater vises`}
            </p>
          </div>
          <Badge variant={result.active ? "default" : "secondary"} className="capitalize">
            {result.active ? (
              <>
                <Clock className="h-3 w-3 mr-1 animate-pulse" />
                Running
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </>
            )}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Start Time</p>
            <p className="font-medium text-foreground">
              {new Date(result.startedAt).toLocaleString('da-DK')}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="font-medium text-foreground">{formatDuration(result.durationSeconds)}</p>
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Meter</TableHead>
                <TableHead className="text-right font-semibold">Messages</TableHead>
                <TableHead className="text-right font-semibold">Avg LQI</TableHead>
                <TableHead className="text-right font-semibold">State Changes</TableHead>
                <TableHead className="text-right font-semibold">Gaps</TableHead>
                <TableHead className="text-right font-semibold">Max Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.meters.map((meter, idx) => (
                <TableRow key={idx} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{meter.meterName}</TableCell>
                  <TableCell className="text-right">{meter.messageCount}</TableCell>
                  <TableCell className="text-right">
                    <span className={meter.avgLqi < 100 ? "text-warning" : "text-success"}>
                      {meter.avgLqi.toFixed(0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{meter.stateChanges}</TableCell>
                  <TableCell className="text-right">
                    {meter.gapCount > 0 ? (
                      <span className="text-warning">{meter.gapCount}</span>
                    ) : (
                      <span className="text-success">{meter.gapCount}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {meter.maxGapMs > 90000 ? (
                      <span className="text-destructive">{(meter.maxGapMs / 1000).toFixed(1)}s</span>
                    ) : (
                      <span>{(meter.maxGapMs / 1000).toFixed(1)}s</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button onClick={onDownloadCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>
      </div>
    </Card>
  );
};
