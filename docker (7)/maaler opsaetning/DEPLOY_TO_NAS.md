# 🚀 Deploy MQTT Config Service til NAS (192.168.9.61)

## 📋 Forudsætninger

- ✅ SSH adgang til NAS
- ✅ Docker installeret på NAS
- ✅ Port 3001 ledig

## 🔧 Installation

### Trin 1: Upload filer til NAS

**Option A: Via SSH/SCP**
```bash
# Fra din computer
scp -r mqtt-config-service/ admin@192.168.9.61:/volume1/docker/
```

**Option B: Via File Station**
1. Åbn File Station på NAS
2. Gå til `/docker/` (opret mappen hvis den ikke findes)
3. Upload hele `mqtt-config-service/` mappen

### Trin 2: SSH til NAS

```bash
ssh admin@192.168.9.61
```

### Trin 3: Byg og start container

```bash
cd /volume1/docker/mqtt-config-service

# Byg og start container
docker-compose up -d --build
```

### Trin 4: Verificer at den kører

```bash
# Tjek at container kører
docker ps | grep mqtt-config-service

# Se logs
docker logs mqtt-config-service
```

**Forventet output:**
```
🚀 MQTT Config Service running on port 3001
📡 MQTT Broker: mqtt://192.168.9.61:1890
🎯 Z2M Topics: zigbee2mqtt, zigbee2mqtt_area2
```

### Trin 5: Test API

```bash
# Fra NAS
curl http://localhost:3001/health

# Fra din computer
curl http://192.168.9.61:3001/health
```

**Forventet response:**
```json
{"status":"ok","service":"mqtt-config-service"}
```

## ✅ Verificering

### Test konfiguration (uden at køre den)

```bash
# Dry run - se hvilke målere der ville blive konfigureret
curl -X POST http://192.168.9.61:3001/configure-meters \
  -H "Content-Type: application/json" \
  -d '{"meters":[]}'
```

### Se logs i real-time

```bash
docker logs -f mqtt-config-service
```

## 🔄 Opdatering

Når du tilføjer flere Z2M instanser:

1. Rediger `server.js`:
```javascript
const Z2M_TOPICS = [
  'zigbee2mqtt',
  'zigbee2mqtt_area2',
  'zigbee2mqtt_area3',  // Ny instance
];
```

2. Genbyg container:
```bash
cd /volume1/docker/mqtt-config-service
docker-compose down
docker-compose up -d --build
```

## 🐛 Fejlfinding

### Container starter ikke

```bash
# Se fejlmeddelelser
docker logs mqtt-config-service

# Tjek om port 3001 er optaget
netstat -tulpn | grep 3001
```

### Kan ikke nå MQTT broker

```bash
# Test fra container
docker exec mqtt-config-service ping 192.168.9.61

# Test MQTT forbindelse
docker exec mqtt-config-service nc -zv 192.168.9.61 1890
```

### Port 3001 optaget

Rediger `docker-compose.yml`:
```yaml
ports:
  - "3002:3001"  # Brug 3002 i stedet
```

Opdater også `Maalere.tsx`:
```typescript
const response = await fetch(`http://192.168.9.61:3002/configure-meters`, {
```

## 📊 Monitoring

### Se status

```bash
docker ps -a | grep mqtt-config-service
```

### Genstart service

```bash
docker-compose restart
```

### Stop service

```bash
docker-compose down
```

### Fjern container og genbyg

```bash
docker-compose down
docker rmi mqtt-config-service
docker-compose up -d --build
```

## 🔐 Sikkerhed

### Firewall regler

Hvis du har firewall på NAS, åbn port 3001:
```bash
# Synology eksempel
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

### Begræns adgang

Rediger `server.js` for kun at tillade lokalt netværk:
```javascript
app.use((req, res, next) => {
  const ip = req.ip;
  if (!ip.startsWith('192.168.9.')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```

## 🎯 Integration med Admin Panel

Admin panelet er allerede konfigureret til at kalde:
```
http://192.168.9.61:3001/configure-meters
```

Test fra admin panel:
1. Gå til http://localhost:8080/admin/maalere
2. Klik "Konfigurer Målere"
3. Servicen konfigurerer alle målere automatisk!

## 📝 Logs

Logs gemmes i Docker:
```bash
# Se alle logs
docker logs mqtt-config-service

# Se sidste 100 linjer
docker logs --tail 100 mqtt-config-service

# Følg logs live
docker logs -f mqtt-config-service
```

## 🔄 Auto-start ved NAS genstart

Docker Compose er konfigureret med `restart: unless-stopped`, så containeren starter automatisk når NAS genstarter.

Verificer:
```bash
docker inspect mqtt-config-service | grep RestartPolicy
```

## ✅ Færdig!

Servicen kører nu på:
- **URL:** http://192.168.9.61:3001
- **Health check:** http://192.168.9.61:3001/health
- **Configure:** POST http://192.168.9.61:3001/configure-meters

**Test det i admin panelet nu!** 🎉
