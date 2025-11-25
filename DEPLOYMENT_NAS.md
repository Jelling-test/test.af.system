# Deployment til NAS - Power Hub Frontend

## Oversigt
- **Port:** 9010
- **URL:** http://192.168.9.61:9010
- **Container navn:** power-hub-frontend

---

## Metode 1: Byg på NAS (anbefalet)

### Trin 1: Kopier projekt til NAS
```bash
# Fra din PC - kopier hele mappen til NAS
scp -r "C:\Users\peter\OneDrive\Skrivebord\hvordan fortsætter jeg\lokal backup 22.11" jc@192.168.9.61:/volume1/docker/power-hub-frontend
```

### Trin 2: SSH til NAS og byg
```bash
ssh jc@192.168.9.61
cd /volume1/docker/power-hub-frontend
sudo docker compose up -d --build
```

### Trin 3: Tjek at det kører
```bash
sudo docker ps | grep power-hub
sudo docker logs power-hub-frontend
```

### Trin 4: Åbn i browser
```
http://192.168.9.61:9010
```

---

## Metode 2: Byg lokalt og kopier

### Trin 1: Byg lokalt
```bash
cd "C:\Users\peter\OneDrive\Skrivebord\hvordan fortsætter jeg\lokal backup 22.11"
npm run build
```

### Trin 2: Kopier dist + config til NAS
```bash
scp -r dist jc@192.168.9.61:/volume1/docker/power-hub-frontend/
scp nginx.conf jc@192.168.9.61:/volume1/docker/power-hub-frontend/
scp docker-compose.yml jc@192.168.9.61:/volume1/docker/power-hub-frontend/
scp Dockerfile jc@192.168.9.61:/volume1/docker/power-hub-frontend/
```

### Trin 3: Byg og start på NAS
```bash
ssh jc@192.168.9.61
cd /volume1/docker/power-hub-frontend
sudo docker compose up -d --build
```

---

## Nyttige kommandoer

### Se logs
```bash
sudo docker logs -f power-hub-frontend
```

### Genstart container
```bash
sudo docker restart power-hub-frontend
```

### Stop container
```bash
sudo docker compose down
```

### Genbyg efter ændringer
```bash
sudo docker compose up -d --build
```

---

## Fejlsøgning

### Container starter ikke
```bash
sudo docker logs power-hub-frontend
```

### Port allerede i brug
```bash
sudo netstat -tlnp | grep 9010
```

### Tjek nginx config
```bash
sudo docker exec power-hub-frontend nginx -t
```

---

## Filer

| Fil | Formål |
|-----|--------|
| `Dockerfile` | Multi-stage build (node → nginx) |
| `docker-compose.yml` | Container konfiguration |
| `nginx.conf` | Webserver + kamera proxy |
| `.dockerignore` | Filer der ikke skal kopieres |
