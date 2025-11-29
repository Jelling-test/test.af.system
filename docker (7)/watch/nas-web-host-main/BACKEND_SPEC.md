# Backend Specifikation - IoT Power Monitor

Dette dokument beskriver den komplette Node.js + Express backend du skal bygge til monitoring systemet.

## Arkitektur Oversigt

```
monitor-backend/
├── server.js              # Main server fil
├── config.json            # Område & MQTT konfiguration
├── package.json
├── .env                   # Miljøvariabler (secrets)
├── routes/
│   ├── areas.js          # GET /api/areas
│   ├── test.js           # POST /api/start-test, /api/stop-test
│   └── monitoring.js     # POST /api/monitoring/start, /stop
├── mqtt/
│   └── client.js         # MQTT forbindelse & handlers
├── websocket/
│   └── server.js         # WebSocket server
└── utils/
    └── supabase.js       # Supabase client
```

## Miljøvariabler (.env)

```env
PORT=3001
WEBSOCKET_PORT=8090
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
NODE_ENV=production
```

## Config.json Struktur

```json
{
  "areas": [
    {
      "id": "1",
      "name": "Område 1",
      "mqtt_topic": "zigbee2mqtt",
      "max_devices": 60,
      "controller": {
        "type": "Sonoff Zigbee 3.0 USB Dongle Plus",
        "firmware": "7.4.3"
      }
    },
    {
      "id": "2",
      "name": "Område 2",
      "mqtt_topic": "zigbee2mqtt_area2",
      "max_devices": 60,
      "controller": {
        "type": "Sonoff Zigbee 3.0 USB Dongle Plus",
        "firmware": "7.4.3"
      }
    }
  ],
  "mqtt": {
    "broker": "mosquitto:1883",
    "username": "homeassistant",
    "password": "YOUR_MQTT_PASSWORD"
  },
  "pairing": {
    "interview_timeout": 300,
    "cooldown_duration": 120,
    "permit_join_duration": 254
  }
}
```

## Supabase Tabeller

**VIGTIGT**: Disse tabeller findes ALLEREDE i Supabase. Backend må IKKE oprette dem, kun bruge dem via queries.

### power_meters
```sql
-- Eksisterende tabel (IKKE opret)
-- Struktur:
{
  id: uuid | int,
  meter_number: text,
  mqtt_topic: text,
  friendly_name: text (optional),
  last_seen: timestamp (optional)
}
```

**Brug:**
```javascript
// Hent antal målere pr. område
const { count } = await supabase
  .from('power_meters')
  .select('*', { count: 'exact', head: true })
  .eq('mqtt_topic', area.mqtt_topic);
```

### monitoring_sessions
```sql
-- Eksisterende tabel (IKKE opret)
-- Struktur:
{
  id: text (fx "mon_123"),
  area_ids: int[],
  start_time: timestamp,
  end_time: timestamp (nullable),
  duration_seconds: int,
  status: text ('active' | 'completed' | 'stopped')
}
```

**Brug:**
```javascript
// Opret ny session
const { data, error } = await supabase
  .from('monitoring_sessions')
  .insert({
    id: `mon_${Date.now()}`,
    area_ids: [1, 2],
    start_time: new Date().toISOString(),
    duration_seconds: 12 * 3600,
    status: 'active'
  })
  .select()
  .single();
```

### monitoring_data
```sql
-- Eksisterende tabel (IKKE opret)
-- Struktur:
{
  id: (auto),
  monitoring_id: text,
  meter_number: text,
  timestamp: timestamp,
  lqi: int (nullable),
  voltage: numeric (nullable),
  current: numeric (nullable),
  power: numeric (nullable),
  energy: numeric (nullable),
  state: text (nullable),
  raw_data: jsonb
}
```

**Brug:**
```javascript
// Gem målerdata under monitoring
const { error } = await supabase
  .from('monitoring_data')
  .insert({
    monitoring_id: sessionId,
    meter_number: 'power_meter_01',
    timestamp: new Date().toISOString(),
    lqi: data.linkquality,
    voltage: data.voltage,
    power: data.power,
    energy: data.energy,
    state: data.state,
    raw_data: data
  });
```

### monitoring_events
```sql
-- Eksisterende tabel (IKKE opret)
-- Struktur:
{
  id: (auto),
  monitoring_id: text,
  meter_number: text,
  event_type: text ('state_change' | 'gap' | 'low_lqi' | ...),
  timestamp: timestamp,
  details: jsonb
}
```

**Brug:**
```javascript
// Log event (fx gap detection)
await supabase
  .from('monitoring_events')
  .insert({
    monitoring_id: sessionId,
    meter_number: 'power_meter_01',
    event_type: 'gap',
    timestamp: new Date().toISOString(),
    details: {
      gap_ms: 95000,
      last_seen: lastTimestamp
    }
  });
```

## API Endpoints

### GET /api/health
Sundhedstjek for backend.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-17T12:00:00Z",
  "mqtt": "connected"
}
```

### GET /api/areas
Hent alle områder med device count.

**Response:**
```json
[
  {
    "id": "1",
    "name": "Område 1",
    "mqtt_topic": "zigbee2mqtt",
    "max_devices": 60,
    "deviceCount": 45,
    "status": "idle",
    "controller": {
      "type": "Sonoff Zigbee 3.0 USB Dongle Plus",
      "firmware": "7.4.3"
    }
  }
]
```

**Implementering:**
```javascript
router.get('/areas', async (req, res) => {
  // Hent device count fra Supabase
  const areasWithCounts = await Promise.all(
    config.areas.map(async (area) => {
      const { count } = await supabase
        .from('power_meters')
        .select('*', { count: 'exact', head: true })
        .eq('mqtt_topic', area.mqtt_topic);
      
      return {
        ...area,
        deviceCount: count || 0,
        status: areaStates[area.id]?.status || 'idle'
      };
    })
  );
  
  res.json(areasWithCounts);
});
```

### POST /api/start-test
Start en 10-minutters test for et område.

**Request:**
```json
{
  "areaId": "1"
}
```

**Response:**
```json
{
  "success": true,
  "areaId": "1",
  "startTime": "2025-01-17T12:00:00Z"
}
```

**Test Data Struktur:**
```javascript
testStates[areaId] = {
  active: true,
  startTime: Date.now(),
  duration: 600, // 10 minutter i sekunder
  metersData: {}, // meter -> array af målinger
  lqiHistory: {}, // meter -> array af LQI værdier
  stateChanges: {}, // meter -> antal state changes
  lastSeen: {}, // meter -> sidste timestamp
  gaps: [] // Array af gaps > 90 sekunder
};
```

### POST /api/stop-test
Stop en kørende test.

**Request:**
```json
{
  "areaId": "1"
}
```

### GET /api/test-result?areaId=1
Hent testresultat for et område.

**Response:**
```json
{
  "areaId": "1",
  "areaName": "Område 1",
  "startTime": "2025-01-17T12:00:00Z",
  "duration": 423,
  "active": false,
  "meters": [
    {
      "meterName": "power_meter_01",
      "messageCount": 142,
      "avgLqi": 187.5,
      "stateChanges": 3,
      "gapCount": 1,
      "maxGapMs": 95000
    }
  ]
}
```

### POST /api/monitoring/start
Start langvarig monitoring (op til 12 timer).

**Request:**
```json
{
  "areaIds": [1, 2],
  "duration": 12
}
```

**Response:**
```json
{
  "success": true,
  "monitoringId": "mon_1737117600000",
  "startTime": "2025-01-17T12:00:00Z",
  "estimatedEndTime": "2025-01-18T00:00:00Z"
}
```

**Implementering:**
```javascript
router.post('/monitoring/start', async (req, res) => {
  const { areaIds, duration } = req.body;
  const monitoringId = `mon_${Date.now()}`;
  
  // Opret session i Supabase
  const { data, error } = await supabase
    .from('monitoring_sessions')
    .insert({
      id: monitoringId,
      area_ids: areaIds,
      start_time: new Date().toISOString(),
      duration_seconds: duration * 3600,
      status: 'active'
    })
    .select()
    .single();
  
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  // Start monitoring logik
  monitoringStates[monitoringId] = {
    sessionId: monitoringId,
    areaIds,
    startTime: Date.now(),
    durationMs: duration * 3600 * 1000,
    active: true
  };
  
  // Sæt auto-stop timeout
  setTimeout(async () => {
    await stopMonitoring(monitoringId);
  }, duration * 3600 * 1000);
  
  res.json({
    success: true,
    monitoringId,
    startTime: data.start_time,
    estimatedEndTime: new Date(Date.now() + duration * 3600 * 1000).toISOString()
  });
});
```

### POST /api/monitoring/stop/:monitoringId
Stop en monitoring session.

**Implementering:**
```javascript
router.post('/monitoring/stop/:monitoringId', async (req, res) => {
  const { monitoringId } = req.params;
  
  // Opdater session i Supabase
  const { error } = await supabase
    .from('monitoring_sessions')
    .update({
      end_time: new Date().toISOString(),
      status: 'stopped'
    })
    .eq('id', monitoringId);
  
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  // Stop monitoring logik
  if (monitoringStates[monitoringId]) {
    monitoringStates[monitoringId].active = false;
    delete monitoringStates[monitoringId];
  }
  
  res.json({ success: true });
});
```

## MQTT Integration

### Subscriptions per område

For hvert område i config.json, subscribe til:

```javascript
const topics = [
  `${area.mqtt_topic}/bridge/event`,
  `${area.mqtt_topic}/bridge/devices`,
  `${area.mqtt_topic}/bridge/state`,
  `${area.mqtt_topic}/#`
];
```

### Message Handlers

#### bridge/event
Håndter device join og interview events:

```javascript
{
  "type": "device_joined",
  "data": {
    "ieee_address": "0x00158d0009123456",
    "friendly_name": "power_meter_01"
  }
}

{
  "type": "device_interview",
  "data": {
    "ieee_address": "0x00158d0009123456",
    "status": "successful",
    "friendly_name": "power_meter_01"
  }
}
```

#### Meter data topics
Format: `{mqtt_topic}/{meter_number}`

Eksempel payload:
```javascript
{
  "battery": 100,
  "voltage": 3000,
  "current": 0.5,
  "energy": 0.12,
  "power": 15,
  "state": "ON",
  "linkquality": 187,
  "last_seen": "2025-01-17T12:00:00Z"
}
```

**Gem til Supabase under monitoring:**
```javascript
if (monitoringStates[sessionId]?.active) {
  await supabase
    .from('monitoring_data')
    .insert({
      monitoring_id: sessionId,
      meter_number: meterNumber,
      timestamp: new Date().toISOString(),
      lqi: data.linkquality,
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      energy: data.energy,
      state: data.state,
      raw_data: data
    });
  
  // Log events
  if (data.linkquality < 100) {
    await supabase
      .from('monitoring_events')
      .insert({
        monitoring_id: sessionId,
        meter_number: meterNumber,
        event_type: 'low_lqi',
        timestamp: new Date().toISOString(),
        details: { lqi: data.linkquality }
      });
  }
}
```

### Test Mode Logic

Når test er aktiv:
1. Gem alle beskeder for området
2. Beregn LQI gennemsnit
3. Tæl state changes (når meter skifter tilstand)
4. Find gaps > 90 sekunder mellem beskeder
5. Track sidste seen timestamp

```javascript
mqtt.on('message', (topic, message) => {
  const area = findAreaByTopic(topic);
  const data = JSON.parse(message.toString());
  
  // Udtræk meter_number fra topic
  const meterNumber = extractMeterNumber(topic);
  
  // Test mode
  const testState = testStates[area.id];
  if (testState?.active) {
    // Gem data
    testState.metersData[meterNumber] = testState.metersData[meterNumber] || [];
    testState.metersData[meterNumber].push({
      timestamp: Date.now(),
      payload: data
    });
    
    // Track LQI
    if (data.linkquality) {
      testState.lqiHistory[meterNumber] = testState.lqiHistory[meterNumber] || [];
      testState.lqiHistory[meterNumber].push(data.linkquality);
    }
    
    // Detect state changes
    const prevState = testState.lastState?.[meterNumber];
    if (prevState && prevState !== data.state) {
      testState.stateChanges[meterNumber] = (testState.stateChanges[meterNumber] || 0) + 1;
    }
    testState.lastState = testState.lastState || {};
    testState.lastState[meterNumber] = data.state;
    
    // Check for gaps (> 90 sekunder)
    const lastSeen = testState.lastSeen[meterNumber];
    if (lastSeen) {
      const gap = Date.now() - lastSeen;
      if (gap > 90000) {
        testState.gaps.push({
          meter: meterNumber,
          gapMs: gap,
          startTime: lastSeen,
          endTime: Date.now()
        });
      }
    }
    testState.lastSeen[meterNumber] = Date.now();
  }
  
  // Monitoring mode
  for (const [sessionId, monState] of Object.entries(monitoringStates)) {
    if (monState.active && monState.areaIds.includes(parseInt(area.id))) {
      // Gem til Supabase
      supabase.from('monitoring_data').insert({
        monitoring_id: sessionId,
        meter_number: meterNumber,
        timestamp: new Date().toISOString(),
        lqi: data.linkquality,
        voltage: data.voltage,
        current: data.current,
        power: data.power,
        energy: data.energy,
        state: data.state,
        raw_data: data
      }).then(({ error }) => {
        if (error) console.error('Error saving monitoring data:', error);
      });
      
      // Log events
      if (data.linkquality && data.linkquality < 100) {
        supabase.from('monitoring_events').insert({
          monitoring_id: sessionId,
          meter_number: meterNumber,
          event_type: 'low_lqi',
          timestamp: new Date().toISOString(),
          details: { lqi: data.linkquality }
        });
      }
    }
  }
});
```

## WebSocket Server

Send real-time opdateringer til frontend:

```javascript
// Ved connection
ws.send(JSON.stringify({
  type: 'init',
  areas: getAllAreas()
}));

// Ved state ændring
broadcastToAll({
  type: 'state_update',
  areaId: '1',
  status: 'test_running'
});
```

## Dependencies (package.json)

```json
{
  "name": "power-monitor-backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "mqtt": "^5.3.0",
    "ws": "^8.16.0",
    "@supabase/supabase-js": "^2.39.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  }
}
```

## Docker Setup

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001 8090

CMD ["node", "server.js"]
```

## Testing

Test endpoints med curl:

```bash
# Health check
curl http://localhost:3010/api/health

# Get areas
curl http://localhost:3010/api/areas

# Start test
curl -X POST http://localhost:3010/api/start-test \
  -H "Content-Type: application/json" \
  -d '{"areaId":"1"}'

# Get results
curl http://localhost:3010/api/test-result?areaId=1
```

## Vigtige Noter

1. **Auto-stop tests**: Implementer timeout der automatisk stopper tests efter 600 sekunder
2. **Error handling**: Håndter MQTT disconnects og reconnect automatisk
3. **Rate limiting**: Overvej rate limiting på API endpoints
4. **Logging**: Brug console.log med timestamps for debugging
5. **CORS**: Tillad frontend URL i CORS headers

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true
}));
```
