# 🔧 Systemovervågning, Fejlsøgning & Genopretning

**Dato:** 15. december 2025  
**System:** Jelling Camping Strømstyringssystem  
**Version:** 2.0

---

## 📊 KOMPLET SYSTEMARKITEKTUR

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD SERVICES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐ │
│  │   VERCEL (Frontend) │  │   SUPABASE (Backend)│  │      STRIPE            │ │
│  │  test-af-system     │  │  - PostgreSQL DB    │  │   (Betalinger)         │ │
│  │  jelling.vercel.app │  │  - 27 Edge Functions│  │                        │ │
│  └──────────┬──────────┘  │  - Realtime WS      │  └───────────┬────────────┘ │
│             │             └──────────┬──────────┘              │              │
└─────────────┼────────────────────────┼─────────────────────────┼──────────────┘
              │                        │                         │
              │              INTERNET  │                         │
              │                        │                         │
┌─────────────┼────────────────────────┼─────────────────────────┼──────────────┐
│             ▼                        ▼                         ▼              │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         NAS (192.168.9.61)                              │  │
│  │                                                                          │  │
│  │  ┌────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐ │  │
│  │  │   Mosquitto    │   │  device-sync.py │   │    Home Assistant       │ │  │
│  │  │  MQTT Broker   │◄──│  (Supabase↔MQTT)│   │   (Statistik)          │ │  │
│  │  │  Port: 1890    │   └─────────────────┘   └─────────────────────────┘ │  │
│  │  └───────┬────────┘                                                      │  │
│  │          │                                                               │  │
│  │  ┌───────▼───────────────────────────────────────────────────────────┐  │  │
│  │  │              6x Zigbee2MQTT Docker Containers                     │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│  │  │
│  │  │  │ Area 1   │ │ Area 2   │ │ Area 3   │ │ Area 4   │ │ Area 5/6 ││  │  │
│  │  │  │ UI: 8082 │ │ UI: 8083 │ │ UI: 8084 │ │ UI: 8085 │ │ 8086/8087││  │  │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘│  │  │
│  │  └───────┼────────────┼────────────┼────────────┼────────────┼──────┘  │  │
│  └──────────┼────────────┼────────────┼────────────┼────────────┼─────────┘  │
│             │            │            │            │            │            │
│  ┌──────────▼────────────▼────────────▼────────────▼────────────▼─────────┐  │
│  │                    6x Zigbee USB Controllere (Ember)                   │  │
│  │  192.168.0.254  192.168.1.35  192.168.1.9  192.168.1.66  0.95  0.60   │  │
│  └────────────────────────────────────┬───────────────────────────────────┘  │
│                                       │                                      │
│                    LOKAL NETVÆRK      │                                      │
└───────────────────────────────────────┼──────────────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────────┐
                        │     ~300 Strømmålere (Tongou)     │
                        │        Zigbee Mesh Netværk        │
                        └───────────────────────────────────┘
```

---

## 🚨 FEJLSCENARIER: Hvad sker der når X går ned?

### 1. VERCEL (Frontend) GÅR NED

| Symptom | Brugere kan ikke tilgå hjemmesiden |
|---------|-------------------------------------|
| **Påvirkning** | Admin/Staff/Gæster kan ikke logge ind eller se data |
| **Strømstyring** | Fungerer stadig via NAS - målere fortsætter |
| **Opdage det** | Besøg https://test-af-system.vercel.app - får fejl |
| **Genopretning** | Vent på Vercel - tjek status.vercel.com |

### 2. SUPABASE GÅR NED

| Symptom | Frontend viser fejl, ingen data loader |
|---------|----------------------------------------|
| **Påvirkning** | - Ingen login mulig |
|                | - Ingen nye bookings |
|                | - Ingen betalinger |
|                | - Emails stoppes |
| **Strømstyring** | **KRITISK**: Kommandoer kan ikke gemmes |
| **Opdage det** | Dashboard viser ingen data, console errors |
| **Genopretning** | Vent på Supabase - tjek status.supabase.com |

### 3. NAS (192.168.9.61) GÅR NED

| Symptom | **TOTALT SYSTEMNEDBRUD for strømstyring** |
|---------|-------------------------------------------|
| **Påvirkning** | - Alle Z2M instanser nede |
|                | - MQTT broker nede |
|                | - device-sync nede |
|                | - Ingen strømdata |
|                | - Ingen ON/OFF kommandoer |
| **Frontend** | Viser gamle data, målere som "offline" |
| **Opdage det** | Ping 192.168.9.61 fejler |
| **Genopretning** | Se sektion nedenfor |

### 4. MQTT BROKER (Mosquitto) GÅR NED

| Symptom | Z2M kan ikke kommunikere |
|---------|--------------------------|
| **Påvirkning** | - device-sync fejler |
|                | - Ingen kommandoer udføres |
|                | - Ingen data synkroniseres |
| **Z2M UI** | Virker stadig lokalt |
| **Opdage det** | `docker logs mosquitto` viser fejl |
| **Genopretning** | `docker restart mosquitto` |

### 5. ÉN Z2M INSTANS GÅR NED (f.eks. Area 1)

| Symptom | Målere i ét område svarer ikke |
|---------|--------------------------------|
| **Påvirkning** | Kun det specifikke område påvirkes |
| **Andre områder** | Fungerer normalt |
| **Opdage det** | Z2M UI på port 8082 svarer ikke |
| **Genopretning** | `docker restart zigbee2mqtt-area1` |

### 6. ZIGBEE CONTROLLER GÅR NED (Hardware)

| Symptom | Alle målere i område vises offline |
|---------|-------------------------------------|
| **Påvirkning** | Hele området mister forbindelse |
| **Z2M UI** | Viser "Coordinator disconnected" |
| **Opdage det** | Z2M logs viser connection errors |
| **Genopretning** | Fysisk genstart af controller, evt. udskift |

### 7. DEVICE-SYNC GÅR NED

| Symptom | Data synkroniseres ikke til Supabase |
|---------|--------------------------------------|
| **Påvirkning** | - power_meters opdateres ikke |
|                | - meter_commands udføres ikke |
|                | - is_online status forkert |
| **Z2M** | Fungerer stadig lokalt |
| **Opdage det** | `docker logs device-sync` |
| **Genopretning** | `docker restart device-sync` |

### 8. STRIPE GÅR NED

| Symptom | Betalinger fejler |
|---------|-------------------|
| **Påvirkning** | Kunder kan ikke købe strømpakker via kort |
| **Alternative** | Reception-betaling virker stadig |
| **Opdage det** | Stripe dashboard viser fejl |
| **Genopretning** | Vent på Stripe - brug reception-betaling |

---

## 📡 OVERVÅGNINGSSTRATEGI

### Niveau 1: Manuel Tjek (Dagligt)

```bash
# SSH til NAS
ssh admin@192.168.9.61

# Tjek alle Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Forventet output: Alle skal vise "Up X hours/days"
```

### Niveau 2: Z2M Health Check

| Område | URL | Forventet |
|--------|-----|-----------|
| Area 1 | http://192.168.9.61:8082 | Permit join, devices list |
| Area 2 | http://192.168.9.61:8083 | Permit join, devices list |
| Area 3 | http://192.168.9.61:8084 | Permit join, devices list |
| Area 4 | http://192.168.9.61:8085 | Permit join, devices list |
| Area 5 | http://192.168.9.61:8086 | Permit join, devices list |
| Area 6 | http://192.168.9.61:8087 | Permit join, devices list |

### Niveau 3: Database Health

```sql
-- Kør i Supabase SQL Editor

-- Tjek antal online/offline målere
SELECT 
  COUNT(*) FILTER (WHERE is_online = true) as online,
  COUNT(*) FILTER (WHERE is_online = false) as offline
FROM power_meters;

-- Tjek pending kommandoer (bør være 0 eller få)
SELECT COUNT(*) FROM meter_commands WHERE status = 'pending';

-- Tjek seneste meter_readings (bør være < 5 min gammel)
SELECT MAX(time) as last_reading FROM meter_readings;
```

### Niveau 4: Automatisk Overvågning (Anbefalet)

**Installer Uptime Kuma på NAS:**
```bash
docker run -d \
  --name uptime-kuma \
  --restart always \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:1
```

**Tilføj disse monitors:**
| Service | Type | URL/Host |
|---------|------|----------|
| Vercel Frontend | HTTP | https://test-af-system.vercel.app |
| Supabase | HTTP | https://jkmqliztlhmfyejhmuil.supabase.co/rest/v1/ |
| MQTT Broker | TCP | 192.168.9.61:1890 |
| Z2M Area 1 | HTTP | http://192.168.9.61:8082 |
| Z2M Area 2 | HTTP | http://192.168.9.61:8083 |
| Z2M Area 3 | HTTP | http://192.168.9.61:8084 |
| Z2M Area 4 | HTTP | http://192.168.9.61:8085 |
| Z2M Area 5 | HTTP | http://192.168.9.61:8086 |
| Z2M Area 6 | HTTP | http://192.168.9.61:8087 |

---

## 🔧 FEJLSØGNINGSKOMMANDOER

### Docker Container Status
```bash
# Se alle containers
docker ps -a

# Se logs for specifik container
docker logs zigbee2mqtt-area1 --tail 100
docker logs mosquitto --tail 100
docker logs device-sync --tail 100

# Genstart container
docker restart <container-name>

# Se resource forbrug
docker stats
```

### MQTT Debugging
```bash
# Test MQTT forbindelse
mosquitto_sub -h 192.168.9.61 -p 1890 -u homeassistant -P '7200Grindsted!' -t '#' -v

# Se beskeder for specifik måler
mosquitto_sub -h 192.168.9.61 -p 1890 -u homeassistant -P '7200Grindsted!' -t 'area1/+/state' -v

# Send test kommando
mosquitto_pub -h 192.168.9.61 -p 1890 -u homeassistant -P '7200Grindsted!' -t 'area1/123/set' -m '{"state":"ON"}'
```

### Supabase Edge Functions
```bash
# Se logs i Supabase Dashboard
# https://supabase.com/dashboard/project/jkmqliztlhmfyejhmuil/functions

# Vigtige funktioner at tjekke:
# - toggle-power (strømkommandoer)
# - webhook (Ankomstlist integration)
# - stripe-webhook (betalinger)
# - check-low-power (advarsler)
```

---

## 🔄 GENOPRETNINGSPROCEDURER

### Scenarie A: NAS Genstart

```bash
# 1. SSH til NAS
ssh admin@192.168.9.61

# 2. Genstart alle containers
cd /jelling-power-system
docker-compose down
docker-compose up -d

# 3. Vent 2-3 minutter

# 4. Verificer alle er oppe
docker ps

# 5. Tjek Z2M UI'erne (8082-8087)
```

### Scenarie B: Z2M Instans Crashed

```bash
# 1. Find container navn
docker ps -a | grep zigbee

# 2. Se fejl logs
docker logs zigbee2mqtt-area1 --tail 200

# 3. Genstart
docker restart zigbee2mqtt-area1

# 4. Hvis det ikke virker - slet og genskab
docker stop zigbee2mqtt-area1
docker rm zigbee2mqtt-area1
docker-compose up -d zigbee2mqtt-area1
```

### Scenarie C: MQTT Broker Nede

```bash
# 1. Tjek status
docker logs mosquitto --tail 100

# 2. Genstart
docker restart mosquitto

# 3. Vent 30 sekunder

# 4. Genstart alle Z2M instanser (de skal reconnecte)
docker restart zigbee2mqtt-area1 zigbee2mqtt-area2 zigbee2mqtt-area3 zigbee2mqtt-area4 zigbee2mqtt-area5 zigbee2mqtt-area6

# 5. Genstart device-sync
docker restart device-sync
```

### Scenarie D: Zigbee Controller Mistet Forbindelse

```bash
# 1. Tjek Z2M logs
docker logs zigbee2mqtt-area1 | grep -i "error\|disconnect\|failed"

# 2. Fysisk tjek:
#    - Er USB kablet tilsluttet?
#    - Er strømforsyningen OK?
#    - Prøv andet USB port

# 3. Genstart Z2M container
docker restart zigbee2mqtt-area1

# 4. Hvis stadig fejl - tjek netværk til remote controller
ping 192.168.0.254  # (Area 1 controller IP)
```

### Scenarie E: Alle Målere Offline (Strømsvigt)

```bash
# 1. Vent til strøm er tilbage

# 2. Målere reconnector automatisk (5-15 min)

# 3. Hvis de ikke reconnector:
#    - Genstart Z2M instanser
#    - Tjek at availability er konfigureret korrekt

# 4. I worst case - genpar målere via Z2M UI
```

---

## 📋 DAGLIG TJEKLISTE

- [ ] Tjek Dashboard - viser det data?
- [ ] Tjek online/offline tæller - er der uventede offline?
- [ ] Tjek pending meter_commands - bør være 0
- [ ] Stikprøve: Tænd/sluk en testmåler

## 📋 UGENTLIG TJEKLISTE

- [ ] SSH til NAS - kør `docker ps` - alle containers "Up"?
- [ ] Tjek alle 6 Z2M UI'er (8082-8087)
- [ ] Tjek disk space på NAS: `df -h`
- [ ] Tjek Supabase database størrelse
- [ ] Gennemgå email_errors i plugin_data

## 📋 MÅNEDLIG TJEKLISTE

- [ ] Test disaster recovery - genstart NAS
- [ ] Verificer backup af Z2M configs
- [ ] Ryd op i gamle meter_readings (>90 dage)
- [ ] Ryd op i gamle meter_commands (completed/failed)
- [ ] Opdater dokumentation hvis noget er ændret

---

## 🆘 KONTAKTINFO VED KRITISKE FEJL

| Problem | Kontakt |
|---------|---------|
| NAS hardware | IT support |
| Supabase nedbrud | https://status.supabase.com |
| Vercel nedbrud | https://vercel-status.com |
| Stripe problemer | https://status.stripe.com |
| Zigbee controller | Udskift med backup enhed |

---

## 📝 VIGTIGE FILER OG STIER

### På NAS (192.168.9.61):
```
/jelling-power-system/
├── docker-compose.yml          # Alle container definitioner
├── mosquitto/
│   └── config/mosquitto.conf   # MQTT konfiguration
├── zigbee2mqtt-area1/
│   ├── configuration.yaml      # Z2M config
│   └── database.db             # Paired devices
├── zigbee2mqtt-area2/
│   └── ...
├── device-sync/
│   └── device_sync.py          # Supabase sync script
└── home-assistant/
    └── configuration.yaml
```

### Supabase Edge Functions:
```
supabase/functions/
├── toggle-power/       # Strøm ON/OFF
├── webhook/            # Ankomstlist integration
├── stripe-webhook/     # Betalingshåndtering
├── check-low-power/    # Advarsel ved lav strøm
├── generate-magic-token/  # Gæsteportal links
└── ...
```

---

**Sidst opdateret:** 15. december 2025
