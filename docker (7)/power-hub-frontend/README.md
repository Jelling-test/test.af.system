# Power Hub Frontend - Klar til NAS

## Indhold
- `dist/` - Færdigbyggede frontend filer
- `nginx.conf` - Webserver konfiguration
- `docker-compose.yml` - Container konfiguration
- `Dockerfile` - Simpel nginx container

## Installation på NAS

### 1. Upload denne mappe til NAS
Upload hele mappen til: `/volume1/docker/power-hub-frontend/`

### 2. Genstart Docker (hvis nødvendigt)
Hvis Docker crashede under tidligere build:
- Gå til DSM → Package Center → Container Manager → Stop → Start

### 3. SSH til NAS og start container
```bash
ssh jc@192.168.9.61
cd /volume1/docker/power-hub-frontend
sudo docker compose up -d --build
```

### 4. Åbn i browser
```
http://192.168.9.61:9010
```

## Nyttige kommandoer

```bash
# Se status
sudo docker ps | grep power-hub

# Se logs
sudo docker logs power-hub-frontend

# Genstart
sudo docker restart power-hub-frontend

# Stop
sudo docker compose down

# Genbyg efter opdatering
sudo docker compose up -d --build
```

## Ved opdateringer

1. Byg på PC: `npm run build` (i lokal backup 22.11)
2. Kopier ny `dist` mappe hertil
3. Upload til NAS
4. Kør: `sudo docker compose up -d --build`
