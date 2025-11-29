import { WebSocketServer } from 'ws';
import { getDeviceStatsForArea } from '../utils/supabase.js';

let wss = null;
const clients = new Set();

export function initWebSocket(port, config, state) {
  wss = new WebSocketServer({ port });

  console.log(`[WebSocket] Server started on port ${port}`);

  wss.on('connection', async (ws) => {
    console.log('[WebSocket] Client connected');
    clients.add(ws);

    // Send initial state with device stats
    try {
      const areas = await Promise.all(config.areas.map(async (area) => {
        try {
          const stats = await getDeviceStatsForArea(area);
          console.log(`[WebSocket] Area ${area.id} stats:`, stats);
          const areaState = state.areaStates[area.id] || {};
          return {
            ...area,
            ...stats,  // Device counts from Supabase
            status: areaState.status || 'idle',
            currentDevice: areaState.currentDevice || null,
            monitoringId: areaState.monitoringId || null
          };
        } catch (error) {
          console.error(`[WebSocket] Failed to get stats for area ${area.id}:`, error);
          const areaState = state.areaStates[area.id] || {};
          return {
            ...area,
            deviceCount: 0,
            devicesOnline: 0,
            devicesOffline: 0,
            status: areaState.status || 'idle',
            currentDevice: areaState.currentDevice || null,
            monitoringId: areaState.monitoringId || null
          };
        }
      }));

      ws.send(JSON.stringify({
        type: 'init',
        areas
      }));
    } catch (error) {
      console.error('[WebSocket] Failed to send initial state:', error);
    }

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      clients.delete(ws);
    });
  });

  return wss;
}

// Broadcast state update to all clients
export function broadcastState(areaId, update) {
  const message = JSON.stringify({
    type: 'state_update',
    areaId,
    ...update
  });

  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

export function getWebSocketServer() {
  return wss;
}
