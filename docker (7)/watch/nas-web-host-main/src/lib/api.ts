// API configuration - auto-detect from window.location or use localStorage
const getApiBaseUrl = () => {
  const stored = localStorage.getItem('apiUrl');
  if (stored) {
    // Remove /api suffix if present (we'll add it in each call)
    return stored.replace(/\/api\/?$/, '');
  }
  
  // Auto-detect from window location
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3010`;
};

// WebSocket URL helper
export const getWsUrl = () => {
  const stored = localStorage.getItem('wsUrl');
  if (stored) return stored;
  
  // Auto-detect from window location
  const { hostname, protocol } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${hostname}:8090`;
};

export const api = {
  // Areas
  getAreas: async () => {
    const response = await fetch(`${getApiBaseUrl()}/api/areas`);
    if (!response.ok) throw new Error('Failed to fetch areas');
    return response.json();
  },

  // Tests
  startTest: async (areaId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/api/start-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId }),
    });
    if (!response.ok) throw new Error('Failed to start test');
    return response.json();
  },

  stopTest: async (areaId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/api/stop-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId }),
    });
    if (!response.ok) throw new Error('Failed to stop test');
    return response.json();
  },

  getTestResult: async (areaId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/api/test-result?areaId=${areaId}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch test result' }));
      throw new Error(error.error || 'Failed to fetch test result');
    }
    return response.json();
  },

  // Monitoring
  startMonitoring: async (areaIds: string[], duration: number = 12) => {
    const response = await fetch(`${getApiBaseUrl()}/api/monitoring/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaIds, duration }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to start monitoring' }));
      throw new Error(error.error || 'Failed to start monitoring');
    }
    return response.json();
  },

  stopMonitoring: async (monitoringId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/api/monitoring/stop/${monitoringId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to stop monitoring' }));
      throw new Error(error.error || 'Failed to stop monitoring');
    }
    return response.json();
  },

  getMonitoringSessions: async () => {
    const response = await fetch(`${getApiBaseUrl()}/api/monitoring/sessions`);
    if (!response.ok) throw new Error('Failed to fetch monitoring sessions');
    return response.json();
  },

  getMonitoringSessionData: async (monitoringId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/api/monitoring/sessions/${monitoringId}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch session data' }));
      throw new Error(error.error || 'Failed to fetch session data');
    }
    return response.json();
  },
};

// CSV export with semicolon separator (Danish format)
export const generateCSV = (meters: any[], areaId: string): void => {
  if (!meters || meters.length === 0) {
    throw new Error('Ingen data at eksportere');
  }

  // Headers
  const headers = ['Måler', 'Antal beskeder', 'Gns. LQI', 'State-changes', 'Antal gaps', 'Max gap (sek.)'];
  
  // Rows
  const rows = meters.map(meter => [
    meter.meterName || '',
    meter.messageCount?.toString() || '0',
    meter.avgLqi ? meter.avgLqi.toFixed(1) : 'N/A',
    meter.stateChanges?.toString() || '0',
    meter.gapCount?.toString() || '0',
    meter.maxGapMs ? Math.round(meter.maxGapMs / 1000).toString() : '0'
  ]);

  // Join with semicolons
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  link.href = url;
  link.download = `test-omraade-${areaId}-${timestamp}.csv`;
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

