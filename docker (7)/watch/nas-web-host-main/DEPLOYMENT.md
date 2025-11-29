# Deployment Guide - IoT Power Monitor

Dette dokument beskriver, hvordan du deployer både frontend og backend til din NAS.

## 📋 Oversigt

Systemet består af:
- **Frontend**: React + Vite app (port 3002)
- **Backend**: Node.js + Express server (port 3010 HTTP, 8090 WebSocket)

Begge services kører i Docker containers på `jelling-iot_ha_net` netværket.

## 🚀 Quick Start

### 1. Klon Repository

```bash
ssh user@your-nas-ip
cd /volume1/docker
git clone <repository-url> power-monitor
cd power-monitor
```

### 2. Konfigurer Backend

Opret `.env` fil i `monitor-backend/`:

```bash
cp monitor-backend/.env.example monitor-backend/.env
nano monitor-backend/.env
```

Udfyld med dine værdier:
```env
PORT=3001
WEBSOCKET_PORT=8090
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
FRONTEND_URL=http://192.168.1.100:3002
NODE_ENV=production
```

**Vigtigt**: Rediger også `monitor-backend/config.json` med:
- Dine MQTT broker credentials
- Område navne og topics
- Controller information

### 3. Deploy med Docker Compose

```bash
docker-compose up -d
```

Dette starter:
- `power-monitor-backend` på port 3010 (HTTP) og 8090 (WebSocket)
- `power-monitor-frontend` på port 3002

### 4. Verificer Deployment

```bash
# Test backend health
curl http://localhost:3010/api/health

# Test frontend (åbn browser)
# http://<nas-ip>:3002
```

## 🔧 Konfiguration

### Auto-detect (anbefalet)

Frontend detekterer automatisk backend URL fra `window.location`:
- API URL: `http://<hostname>:3010`
- WebSocket URL: `ws://<hostname>:8090`

Dette virker når du tilgår frontend via din NAS IP.

### Manuel konfiguration (kun hvis nødvendigt)

Hvis auto-detect ikke virker:

1. Åbn frontend: `http://<nas-ip>:3002`
2. Klik på Settings (⚙️ ikon top højre)
3. Indtast:
   - **API URL**: `http://<nas-ip>:3010`
   - **WebSocket URL**: `ws://<nas-ip>:8090`
4. Klik "Gem indstillinger"

## 📁 Mappestruktur

```
power-monitor/
├── docker-compose.yml          # Orchestrerer begge services
├── Dockerfile                  # Frontend (React + Nginx)
├── nginx.conf                  # Nginx config til SPA routing
├── src/                        # Frontend source code
│   ├── components/
│   ├── pages/
│   ├── lib/
│   └── ...
├── monitor-backend/
│   ├── Dockerfile             # Backend Node.js
│   ├── server.js              # Main server file
│   ├── config.json            # MQTT & område config
│   ├── .env                   # Backend secrets (GIT IGNORED!)
│   ├── package.json
│   ├── routes/
│   ├── mqtt/
│   ├── websocket/
│   └── utils/
├── DEPLOYMENT.md              # Denne fil
├── BACKEND_SPEC.md            # Backend specifikation
└── SUPABASE_QUERIES.md        # Supabase query reference
```

## 🔄 Opdatering

For at opdatere til en ny version:

```bash
cd /volume1/docker/power-monitor

# Pull seneste ændringer
git pull

# Stop containers
docker-compose down

# Rebuild og start
docker-compose up -d --build
```

## 🐛 Fejlfinding

### Backend starter ikke

```bash
# Tjek logs
docker logs power-monitor-backend

# Verificer .env fil
cat monitor-backend/.env

# Tjek MQTT forbindelse
docker exec power-monitor-backend wget -qO- mosquitto:1883
```

### Frontend kan ikke forbinde til backend

1. **Tjek Settings side**: Gå til frontend Settings og verificer URLs
2. **Test backend direkte**: `curl http://<nas-ip>:3010/api/health`
3. **Tjek browser console**: Åbn DevTools (F12) og se efter fejl
4. **CORS problemer**: Verificer `FRONTEND_URL` i backend .env

### WebSocket forbindelse fejler

**Symptomer**: "WebSocket error" i console, ingen live updates

**Løsning**:
1. Tjek at port 8090 er åben: `netstat -tulpn | grep 8090`
2. Verificer WebSocket URL i Settings bruger `ws://` (ikke `wss://`)
3. Tjek backend logs for MQTT forbindelse

### Container port konflikter

```bash
# Find proces der bruger porten
sudo netstat -tulpn | grep :3002

# Stop konfliktende container
docker stop <container-name>

# Eller skift port i docker-compose.yml
ports:
  - "3003:80"  # Brug anden port
```

### MQTT forbindelse fejler

**Tjek**:
1. MQTT broker kører: `docker ps | grep mosquitto`
2. Backend kan nå broker: `docker exec power-monitor-backend ping mosquitto`
3. Credentials i `config.json` er korrekte
4. Topics i `config.json` matcher dit Zigbee2MQTT setup

## 📊 Monitoring

### Tjek container status

```bash
docker-compose ps
```

### Se logs (live)

```bash
# Backend
docker logs -f power-monitor-backend

# Frontend (nginx access log)
docker logs -f power-monitor-frontend
```

### Ressource forbrug

```bash
docker stats power-monitor-backend power-monitor-frontend
```

## 🔐 Sikkerhed

1. **Passwords**: Undlad at committe `.env` til git (allerede i .gitignore)
2. **Firewall**: Overvej at begrænse adgang til ports 3010 og 8090
3. **Supabase**: Brug service role key (ikke anon key) i backend
4. **HTTPS**: For produktion, tilføj reverse proxy (fx Traefik eller Nginx Proxy Manager)

## 🚀 Produktion Tips

### Brug reverse proxy

Tilføj Nginx Proxy Manager eller Traefik foran:
- SSL/TLS certificates
- Automatisk HTTPS redirect
- Bedre logging og monitoring

### Backup

Backup følgende regelmæssigt:
- `monitor-backend/config.json`
- `monitor-backend/.env`
- Supabase database (via Supabase dashboard)

### Health Checks

Docker Compose inkluderer health checks. Se status:

```bash
docker inspect power-monitor-backend | grep -A 5 Health
docker inspect power-monitor-frontend | grep -A 5 Health
```

## 📚 Yderligere Dokumentation

- [BACKEND_SPEC.md](BACKEND_SPEC.md) - Komplet backend API specifikation
- [SUPABASE_QUERIES.md](SUPABASE_QUERIES.md) - Database query eksempler
- Backend README: `monitor-backend/README.md`

## 🆘 Support

Ved problemer:
1. Tjek logs først
2. Verificer alle konfigurationsfiler
3. Test backend API direkte med curl
4. Tjek browser DevTools console
