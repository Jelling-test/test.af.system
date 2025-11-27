# 🔧 MQTT Configuration Service

Docker container der kører på din NAS og konfigurerer Tongou målere via MQTT.

## 📋 Features

- ✅ HTTP API til at konfigurere målere
- ✅ Håndterer multiple Z2M instanser automatisk
- ✅ Kører i Docker container på NAS
- ✅ Kan kaldes fra admin panel

## 🚀 Installation på NAS

### Trin 1: Upload filer til NAS

Upload hele `mqtt-config-service` mappen til din NAS, f.eks. til:
```
/volume1/docker/mqtt-config-service/
```

### Trin 2: SSH til NAS og byg container

```bash
cd /volume1/docker/mqtt-config-service
docker-compose up -d --build
```

### Trin 3: Verificer at den kører

```bash
docker ps | grep mqtt-config-service
docker logs mqtt-config-service
```

Du skulle se:
```
🚀 MQTT Config Service running on port 3001
📡 MQTT Broker: mqtt://192.168.9.61:1890
🎯 Z2M Topics: zigbee2mqtt, zigbee2mqtt_area2
```

### Trin 4: Test API

```bash
curl http://localhost:3001/health
```

Skulle returnere:
```json
{"status":"ok","service":"mqtt-config-service"}
```

## 🔧 Brug fra Admin Panel

Servicen er tilgængelig på:
```
http://[DIN-NAS-IP]:3001
```

For at konfigurere målere, send POST request til:
```
POST http://[DIN-NAS-IP]:3001/configure-meters
```

## 📝 API Endpoints

### GET /health
Tjek om servicen kører

**Response:**
```json
{
  "status": "ok",
  "service": "mqtt-config-service"
}
```

### POST /configure-meters
Konfigurer alle Tongou målere

**Response:**
```json
{
  "success": true,
  "configured": 45,
  "failed": 0,
  "total": 45
}
```

## 🔄 Opdatering

Når du tilføjer flere Z2M instanser, opdater `server.js`:

```javascript
const Z2M_TOPICS = [
  'zigbee2mqtt',
  'zigbee2mqtt_area2',
  'zigbee2mqtt_area3',  // Tilføj her
  'zigbee2mqtt_area4',  // Og her
];
```

Derefter genbyg container:
```bash
docker-compose down
docker-compose up -d --build
```

## 🐛 Fejlfinding

### Container starter ikke

```bash
docker logs mqtt-config-service
```

### Kan ikke nå MQTT broker

Tjek at NAS kan nå 192.168.9.61:1890:
```bash
docker exec mqtt-config-service ping 192.168.9.61
```

### Port 3001 optaget

Ændr port i `docker-compose.yml`:
```yaml
ports:
  - "3002:3001"  # Brug 3002 i stedet
```

## 📊 Monitoring

Se logs i real-time:
```bash
docker logs -f mqtt-config-service
```

Genstart service:
```bash
docker-compose restart
```

Stop service:
```bash
docker-compose down
```

## 🔐 Sikkerhed

**VIGTIGT:** Servicen indeholder MQTT credentials i koden!

For produktion, brug environment variables i stedet:

**docker-compose.yml:**
```yaml
environment:
  - MQTT_BROKER=mqtt://192.168.9.61:1890
  - MQTT_USERNAME=homeassistant
  - MQTT_PASSWORD=7200Grindsted!
```

**server.js:**
```javascript
const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
```
