import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { StatusIndicator } from "@/components/dashboard/StatusIndicator";
import { AreaCard } from "@/components/dashboard/AreaCard";
import { TestResultsPanel } from "@/components/results/TestResultsPanel";
import { LQIChart } from "@/components/charts/LQIChart";
import { GapsChart } from "@/components/charts/GapsChart";
import { MonitoringResults } from "@/pages/MonitoringResults";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api, generateCSV, getWsUrl } from "@/lib/api";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BackendTestResult {
  area: { id: string; name: string };
  startedAt?: string;
  durationSeconds?: number;
  active: boolean;
  meters?: any[];
}

const Index = () => {
  const WS_URL = getWsUrl();
  const { areas, isConnected } = useWebSocket(WS_URL);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "results" | "monitoring">("dashboard");
  const [selectedTestAreaId, setSelectedTestAreaId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [areaMonitoringIds, setAreaMonitoringIds] = useState<Record<string, string | null>>({});

  const activeTests = areas.filter(a => a.status === 'test_running').length;
  const activeSessions = areas.filter(a => a.status === 'monitoring').length;

  const handleStartTest = async (areaId: string) => {
    try {
      await api.startTest(areaId);
      toast.success("Test started successfully");
      setSelectedTestAreaId(areaId);
      setActiveTab("results");
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start test';
      toast.error(message);
      console.error(error);
    }
  };

  const handleStopTest = async (areaId: string) => {
    try {
      await api.stopTest(areaId);
      toast.success("Test stopped");
    } catch (error) {
      toast.error("Failed to stop test");
      console.error(error);
    }
  };

  const handleStartMonitoring = async (areaId: string) => {
    try {
      const response = await api.startMonitoring([areaId], 12);
      if (response?.monitoringId) {
        setAreaMonitoringIds(prev => ({ ...prev, [areaId]: response.monitoringId }));
      }
      toast.success("12-hour monitoring session started");
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start monitoring';
      toast.error(message);
      console.error(error);
    }
  };

  const handleStopMonitoring = async (areaId: string) => {
    try {
      // Find area and get monitoringId from WebSocket data
      const area = areas.find(a => a.id === areaId);
      const monitoringId = area?.monitoringId || areaMonitoringIds[areaId];
      
      if (!monitoringId) {
        toast.error("No active monitoring session for this area");
        return;
      }

      await api.stopMonitoring(monitoringId);
      toast.success("Monitoring stopped");
      setAreaMonitoringIds(prev => ({ ...prev, [areaId]: null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop monitoring';
      toast.error(message);
      console.error(error);
    }
  };

  const handleViewResults = async (areaId: string) => {
    setSelectedTestAreaId(areaId);
    try {
      const result: BackendTestResult = await api.getTestResult(areaId);

      // Enrich with device count info from areas
      const areaInfo = areas.find(a => a.id === areaId);

      const mapped = {
        area: {
          ...result.area,
          deviceCount: areaInfo?.deviceCount,
          devicesOnline: areaInfo?.devicesOnline,
          devicesOffline: areaInfo?.devicesOffline,
        },
        startedAt: result.startedAt ?? (result as any).startTime ?? new Date().toISOString(),
        durationSeconds: result.durationSeconds ?? (result as any).duration ?? 0,
        active: result.active,
        meters: result.meters ?? [],
      };

      setTestResult(mapped);
      setActiveTab("results");
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fejl ved hentning af testresultat';
      toast.error(message);
      console.error(error);
    }
  };

  const handleDownloadCSV = () => {
    if (testResult && testResult.meters && testResult.area) {
      try {
        generateCSV(testResult.meters, testResult.area.id);
        toast.success("CSV downloaded");
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Fejl ved generering af CSV';
        toast.error(message);
        console.error(error);
      }
    } else {
      toast.error('Ingen data at eksportere');
    }
  };

  // Auto-fetch test results when an area is running a test
  useEffect(() => {
    if (selectedTestAreaId) {
      const selectedArea = areas.find(a => a.id === selectedTestAreaId);
      
      if (selectedArea?.status === 'test_running') {
        const interval = setInterval(async () => {
          try {
            const result: BackendTestResult = await api.getTestResult(selectedTestAreaId);
            const mapped = {
              area: result.area,
              startedAt: result.startedAt ?? (result as any).startTime ?? new Date().toISOString(),
              durationSeconds: result.durationSeconds ?? (result as any).duration ?? 0,
              active: result.active,
              meters: result.meters ?? [],
            };
            setTestResult(mapped);
          } catch (error) {
            console.error('Failed to fetch test result:', error);
          }
        }, 5000);
        
        setPollingInterval(interval);
        
        return () => {
          if (interval) clearInterval(interval);
        };
      } else if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [selectedTestAreaId, areas]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <StatusIndicator 
          isConnected={isConnected}
          activeTests={activeTests}
          activeSessions={activeSessions}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="results">Test Results</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring Results</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Monitoring Areas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {areas.map(area => (
                  <AreaCard
                    key={area.id}
                    area={area}
                    onStartTest={handleStartTest}
                    onStopTest={handleStopTest}
                    onStartMonitoring={handleStartMonitoring}
                    onStopMonitoring={handleStopMonitoring}
                    onViewResults={handleViewResults}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-6 mt-6">
            <div>
              <h2 className="text-lg font-semibold mb-2 text-foreground">Select Area</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {areas.map(area => (
                  <button
                    key={area.id}
                    className={`px-3 py-1 rounded border text-sm ${selectedTestAreaId === area.id ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
                    onClick={() => handleViewResults(area.id)}
                  >
                    {area.name}
                  </button>
                ))}
              </div>
            </div>
            <TestResultsPanel 
              result={testResult}
              onDownloadCSV={handleDownloadCSV}
            />

            {testResult && testResult.meters && testResult.meters.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LQIChart data={testResult.meters} />
                <GapsChart data={testResult.meters} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6 mt-6">
            <MonitoringResults />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
