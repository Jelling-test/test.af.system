import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestResultsPanel } from "@/components/results/TestResultsPanel";
import { LQIChart } from "@/components/charts/LQIChart";
import { GapsChart } from "@/components/charts/GapsChart";
import { api, generateCSV } from "@/lib/api";
import { toast } from "sonner";
import { Clock, CheckCircle2, RefreshCw } from "lucide-react";

interface MonitoringSession {
  id: string;
  area_ids: number[];
  areaNames: string[];
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  status: 'active' | 'stopped';
}

export const MonitoringResults = () => {
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Load sessions
  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await api.getMonitoringSessions();
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to load monitoring sessions:', error);
      toast.error('Failed to load monitoring sessions');
    } finally {
      setLoading(false);
    }
  };

  // Load session data
  const loadSessionData = async (sessionId: string) => {
    setLoadingData(true);
    setSelectedSessionId(sessionId);
    try {
      const response = await api.getMonitoringSessionData(sessionId);
      
      // Map to TestResultsPanel format
      const mapped = {
        area: {
          id: response.session.areaIds[0]?.toString() || '',
          name: response.session.areaNames.join(', ')
        },
        startedAt: response.session.startedAt,
        durationSeconds: response.session.durationSeconds,
        active: response.session.status === 'active',
        meters: response.meters || []
      };
      
      setSessionData(mapped);
    } catch (error) {
      console.error('Failed to load session data:', error);
      toast.error('Failed to load session data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleDownloadCSV = () => {
    if (sessionData && sessionData.meters) {
      try {
        generateCSV(sessionData.meters, selectedSessionId || 'monitoring');
        toast.success("CSV downloaded");
      } catch (error) {
        toast.error('Failed to generate CSV');
      }
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Auto-refresh active sessions every 10 seconds
  useEffect(() => {
    if (!selectedSessionId) return;
    
    const selectedSession = sessions.find(s => s.id === selectedSessionId);
    if (selectedSession?.status === 'active') {
      const interval = setInterval(() => {
        loadSessionData(selectedSessionId);
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [selectedSessionId, sessions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Monitoring Sessions</h2>
        <Button onClick={loadSessions} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card className="p-8">
          <p className="text-center text-muted-foreground">Loading sessions...</p>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="p-8">
          <p className="text-center text-muted-foreground">No monitoring sessions found</p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Start a 12-hour monitoring session from the Dashboard
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="space-y-4">
              <Card 
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedSessionId === session.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => loadSessionData(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {session.areaNames.join(', ')}
                      </h3>
                      <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                        {session.status === 'active' ? (
                          <>
                            <Clock className="h-3 w-3 mr-1 animate-pulse" />
                            Active
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Stopped
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Started: {new Date(session.start_time).toLocaleString('da-DK')}
                    </p>
                    {session.end_time && (
                      <p className="text-sm text-muted-foreground">
                        Ended: {new Date(session.end_time).toLocaleString('da-DK')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">
                      ID: {session.id}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Show details directly under the selected session */}
              {selectedSessionId === session.id && (
                <>
                  {loadingData ? (
                    <Card className="p-8">
                      <p className="text-center text-muted-foreground">Loading session data...</p>
                    </Card>
                  ) : sessionData ? (
                    <>
                      <TestResultsPanel 
                        result={sessionData}
                        onDownloadCSV={handleDownloadCSV}
                      />

                      {sessionData.meters && sessionData.meters.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <LQIChart data={sessionData.meters} />
                          <GapsChart data={sessionData.meters} />
                        </div>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
