import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { initMQTT } from './mqtt/client.js';
import { initWebSocket, broadcastState } from './websocket/server.js';
import { createAreasRouter } from './routes/areas.js';
import { createTestRouter } from './routes/test.js';
import { createMonitoringRouter } from './routes/monitoring.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8090;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3002';

// Load configuration
let config;
try {
  config = JSON.parse(readFileSync('./config.json', 'utf8'));
  console.log(`[CONFIG] Loaded ${config.areas.length} areas`);
} catch (error) {
  console.error('[CONFIG] Error loading config.json:', error);
  process.exit(1);
}

// Initialize application state
const state = {
  // Area states
  areaStates: {},
  
  // Test states (10-min tests)
  areaTests: {},
  
  // Monitoring sessions
  monitoringSessions: new Map()
};

// Initialize area states
config.areas.forEach(area => {
  state.areaStates[area.id] = {
    status: 'idle',
    deviceCount: 0,
    currentDevice: null
  };
  state.areaTests[area.id] = {
    active: false,
    startTime: null,
    duration: 600,
    metersData: new Map(),
    lqiHistory: new Map(),
    stateChanges: new Map(),
    lastSeen: new Map(),
    gaps: new Map(),
    lastState: new Map()
  };
});

// Initialize Express app
const app = express();

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    areas: config.areas.map(a => ({ id: a.id, name: a.name }))
  });
});

// Mount routers
app.use('/api/areas', createAreasRouter(config, state));
app.use('/api', createTestRouter(config, state, broadcastState));
app.use('/api/monitoring', createMonitoringRouter(config, state, broadcastState));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start servers
const server = app.listen(PORT, () => {
  console.log(`[HTTP] Server running on port ${PORT}`);
});

// Initialize WebSocket
initWebSocket(WEBSOCKET_PORT, config, state);

// Initialize MQTT
initMQTT(config, state, broadcastState);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] HTTP server closed');
    process.exit(0);
  });
});

console.log('═══════════════════════════════════════════════════');
console.log('  IoT Power Monitor Backend');
console.log('═══════════════════════════════════════════════════');
console.log(`  HTTP API:    http://localhost:${PORT}`);
console.log(`  WebSocket:   ws://localhost:${WEBSOCKET_PORT}`);
console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('═══════════════════════════════════════════════════');
