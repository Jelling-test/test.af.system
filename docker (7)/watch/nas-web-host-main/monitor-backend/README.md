# Power Monitor Backend

Node.js backend for the IoT Power Monitor system.

## Features

- **MQTT Integration**: Connects to Zigbee2MQTT and processes device messages
- **10-Minute Tests**: Track LQI, gaps, and state changes for quick diagnostics
- **Long-term Monitoring**: Store up to 12 hours of data in Supabase
- **Real-time WebSocket**: Push live updates to frontend
- **REST API**: Full API for controlling tests and monitoring

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `PORT`: HTTP API port (default: 3001)
- `WEBSOCKET_PORT`: WebSocket port (default: 8090)

### 3. Configure Areas

Edit `config.json` to match your setup:
- Add your areas with MQTT topics
- Set MQTT broker connection details
- Configure pairing settings

### 4. Run

Development (with auto-reload):
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Endpoints

### Health Check
```bash
GET /api/health
```

### Get Areas
```bash
GET /api/areas
```

### Start Test
```bash
POST /api/start-test
Content-Type: application/json

{
  "areaId": "1"
}
```

### Stop Test
```bash
POST /api/stop-test
Content-Type: application/json

{
  "areaId": "1"
}
```

### Get Test Results
```bash
GET /api/test-result?areaId=1
```

### Start Monitoring
```bash
POST /api/monitoring/start
Content-Type: application/json

{
  "areaIds": [1, 2],
  "duration": 12
}
```

### Stop Monitoring
```bash
POST /api/monitoring/stop/mon_1234567890
```

## Docker Deployment

Build and run with Docker:

```bash
docker build -t power-monitor-backend .
docker run -p 3001:3001 -p 8090:8090 --env-file .env power-monitor-backend
```

Or use docker-compose (from project root):

```bash
docker-compose up -d
```

## WebSocket Protocol

Connect to `ws://localhost:8090` and receive:

### Init Message (on connect)
```json
{
  "type": "init",
  "areas": [...]
}
```

### State Updates
```json
{
  "type": "state_update",
  "areaId": "1",
  "state": {
    "status": "test_running",
    "deviceCount": 45
  }
}
```

## Troubleshooting

### MQTT Connection Issues
- Verify broker address and credentials in `config.json`
- Check network connectivity to MQTT broker
- Ensure MQTT broker allows connections from backend

### Supabase Errors
- Verify `.env` has correct Supabase credentials
- Check that tables exist in Supabase (see BACKEND_SPEC.md)
- Ensure service role key has proper permissions

### WebSocket Not Working
- Check firewall rules for WebSocket port
- Verify frontend is connecting to correct WebSocket URL
- Check browser console for connection errors

## Development

Project structure:
```
monitor-backend/
├── server.js           # Main entry point
├── config.json         # Area configuration
├── routes/
│   ├── areas.js       # Area endpoints
│   ├── test.js        # Test endpoints
│   └── monitoring.js  # Monitoring endpoints
├── mqtt/
│   └── client.js      # MQTT connection & handlers
├── websocket/
│   └── server.js      # WebSocket server
└── utils/
    └── supabase.js    # Supabase helpers
```

## License

MIT
