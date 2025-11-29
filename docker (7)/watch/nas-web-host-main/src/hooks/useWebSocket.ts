import { useEffect, useState, useCallback } from 'react';

interface AreaState {
  id: string;
  name: string;
  mqtt_topic: string;
  deviceCount: number;
  devicesOnline?: number;
  devicesOffline?: number;
  status: string;
  monitoringId?: string;
}

interface WebSocketMessage {
  type: 'init' | 'state_update';
  areas?: AreaState[];
  areaId?: string;
  status?: string;
  monitoringId?: string;
}

export const useWebSocket = (url: string) => {
  const [areas, setAreas] = useState<AreaState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket(url);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        if (message.type === 'init' && message.areas) {
          setAreas(message.areas);
        } else if (message.type === 'state_update' && message.areaId && message.status) {
          setAreas(prev => 
            prev.map(area => 
              area.id === message.areaId 
                ? { 
                    ...area, 
                    status: message.status!,
                    ...(message.monitoringId !== undefined && { monitoringId: message.monitoringId })
                  }
                : area
            )
          );
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, [ws]);

  return { areas, isConnected, sendMessage };
};
