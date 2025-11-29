# 🔍 Systemanalyse: Svagheder, Flaskehalse & Nedbrudspotentiale

**Dato:** 29. november 2025  
**System:** Jelling Camping Strømstyringssystem  
**Målere:** 300+ Zigbee-enheder fordelt på 6 områder

---

## 📊 Systemarkitektur Overblik

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                               │
│                    jelling-power-hub.netlify.app                        │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                        SUPABASE CLOUD                                    │
│  ┌─────────────┐ ┌──────────────────┐ ┌────────────────────────────┐   │
│  │  Database   │ │  Edge Functions  │ │     Realtime (WebSocket)   │   │
│  │ (PostgreSQL)│ │  - toggle-power  │ │                            │   │
│  │             │ │  - monitor-usage │ │                            │   │
│  │             │ │  - webhook       │ │                            │   │
│  └─────────────┘ └──────────────────┘ └────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                         NAS (192.168.9.61)                              │
│                                                                          │
│  ┌────────────────┐   ┌─────────────────────────────────────────────┐  │
│  │   Mosquitto    │◄──│              device-sync.py                  │  │
│  │  MQTT Broker   │   │         (Supabase ↔ MQTT sync)              │  │
│  │  Port 1890     │   └─────────────────────────────────────────────┘  │
│  └───────┬────────┘                                                      │
│          │                                                               │
│  ┌───────▼────────────────────────────────────────────────────────────┐ │
│  │                    6x Zigbee2MQTT Instanser                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │ │
│  │  │ Area 1   │ │ Area 2   │ │ Area 3   │ │ Area 4   │ ...         │ │
│  │  │ Port 8082│ │ Port 8083│ │ Port 8084│ │ Port 8085│              │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘              │ │
│  └───────┼────────────┼────────────┼────────────┼────────────────────┘ │
│          │            │            │            │                       │
└──────────┼────────────┼────────────┼────────────┼───────────────────────┘
           │            │            │            │
           ▼            ▼            ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Zigbee   │  │ Zigbee   │  │ Zigbee   │  │ Zigbee   │
    │Controller│  │Controller│  │Controller│  │Controller│
    │ (Ember)  │  │ (Ember)  │  │ (Ember)  │  │ (Ember)  │
    └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │             │             │
    ┌────▼─────────────▼─────────────▼─────────────▼────┐
    │           ~300 Strømmålere (Tongou)               │
    │              Zigbee Mesh Netværk                  │
    └───────────────────────────────────────────────────┘
```

---

## 🚨 KRITISKE SVAGHEDER (Prioritet 1)

### 1. ✅ Z2M Ping Cascade (RETTET I DAG)

**Problem:** Når en Zigbee controller mistede forbindelse til mange målere (f.eks. sikringssvigt), ville Z2M blive ved med at pinge ALLE offline målere i det uendelige, hvilket overbelastede hele Zigbee mesh-netværket.

**Konsekvens:** Systemet kunne blive ubrugeligt i timer/dage.

**Status:** ✅ RETTET med `pause_on_backoff_gt: 15` konfiguration.

---

### 2. ⚠️ MQTT Broker = Single Point of Failure

**Problem:** Mosquitto MQTT broker (port 1890) er en ENKELT instans uden redundans.

**Konsekvens ved nedbrud:**
- ALLE 6 Z2M instanser mister kommunikation
- Ingen strømkommandoer kan udføres
- device-sync.py fejler
- maaler-opsaetning service fejler

**Løsning:**
```yaml
# Mulig løsning: MQTT Cluster med HiveMQ eller EMQX
# Alternativt: Mosquitto med disk-baseret persistence + automatisk genstart
```

**Anbefaling:**
- [ ] Overvej MQTT broker clustering (HiveMQ/EMQX)
- [ ] Implementér health-check med automatisk container genstart
- [ ] Tilføj monitoring/alerting på MQTT broker status

---

### 3. ⚠️ NAS = Single Point of Failure

**Problem:** ALLE kritiske services kører på ÉN NAS (192.168.9.61):
- Mosquitto MQTT
- 6x Zigbee2MQTT
- device-sync
- Home Assistant
- Telegraf

**Konsekvens ved NAS-nedbrud:**
- Komplet systemnedbrud
- Ingen strømstyring mulig
- Data-tab for meter_readings (hvis ikke synkroniseret)

**Løsning:**
- [ ] Overvej sekundær NAS med failover
- [ ] Flyt kritiske services til separat hardware
- [ ] Implementér offsite backup af konfigurationsfiler

---

### 4. ⚠️ Supabase Edge Functions - Ingen Retry Logic

**Fil:** `supabase/functions/toggle-power/index.ts`

**Problem:** Når en strømkommando sendes, indsættes den i `meter_commands` tabellen. Hvis:
1. Supabase er nede → kommando tabt
2. device-sync ikke kører → kommando aldrig udført
3. MQTT fejler → kommando sidder fast som "pending"

**Nuværende kode (linje 148-158):**
```typescript
// Insert command into meter_commands table
const { error: insertError } = await supabase
  .from('meter_commands')
  .insert({
    meter_id: maaler_id,
    command: 'set_state',
    value: action === 'on' ? 'ON' : 'OFF',
    status: 'pending'
  });
```

**Mangler:**
- [ ] Ingen timeout håndtering for "pending" kommandoer
- [ ] Ingen automatisk retry
- [ ] Ingen feedback til bruger hvis kommando fejler
- [ ] Ingen cleanup af gamle "pending" kommandoer

---

### 5. ⚠️ device_sync.py - Ingen is_online Opdatering

**Fil:** `device-sync/device_sync.py`

**Problem:** Scriptet synkroniserer enheder til Supabase, men opdaterer IKKE `power_meters.is_online` baseret på Zigbee2MQTT availability status.

**Konsekvens:**
- Frontend viser altid `is_online: true` (default)
- Brugere kan ikke se om en måler faktisk er offline
- Inkonsistens mellem Z2M UI og webapp

**Nuværende kode (linje 48-62):**
```python
def upsert_meter_identity(..., availability: str | None, ...):
    payload = {
        "ieee_address": ieee,
        "meter_number": friendly_name,
        "base_topic": base_topic,
        "last_seen": last_seen,
        "availability": availability,  # Gemmes i meter_identity
        "model": model,
        "updated_at": now_iso,
    }
    # ... men power_meters.is_online opdateres ALDRIG!
```

**Løsning:**
```python
# Tilføj i upsert_power_meter():
is_online = availability == "online" if availability else True
sb.table("power_meters").upsert({
    "meter_number": friendly_name,
    "mqtt_topic": topic,
    "is_online": is_online,  # <-- TILFØJ DETTE
    "updated_at": now_iso,
}, on_conflict="meter_number").execute()
```

---

## ⚡ FLASKEHALSE (Prioritet 2)

### 6. Zigbee Mesh Kapacitet

**Problem:** Hver Zigbee controller har en teoretisk grænse på ~200-400 enheder (afhængig af trafik).

**Nuværende setup:**
| Område | Controller | Estimeret antal |
|--------|------------|-----------------|
| Area 1 | 192.168.0.254:6638 | ~50 |
| Area 2 | 192.168.1.35:6638 | ~50 |
| Area 3 | 192.168.1.9:6638 | ~10 |
| Area 4 | 192.168.1.66:6638 | ~10 |
| Area 5 | 192.168.0.95:6638 | ~10 |
| Area 6 | 192.168.0.60:6638 | ~10 |

**Risiko:** Hvis ét område vokser til 100+ målere, kan responstid degradere.

**Anbefaling:**
- [ ] Monitorer `messages_per_sec` i Z2M health logs
- [ ] Overvej repeaters hvis signal er svagt
- [ ] Split store områder ved behov

---

### 7. Database Queries i meter_readings

**Problem:** `meter_readings` tabellen vokser konstant (hver måler sender data hvert minut).

**Beregning:**
- 300 målere × 1 reading/min × 60 min × 24 timer = **432.000 rows/dag**
- **13 millioner rows/måned**

**Risiko:**
- Langsomme queries i Dashboard
- Supabase storage limits
- Backup/restore tid

**Anbefaling:**
- [ ] Implementér data retention policy (f.eks. slet readings ældre end 90 dage)
- [ ] Overvej TimescaleDB til time-series data
- [ ] Tilføj database indexes på (meter_id, time)

---

### 8. MQTT QoS = 1 (At Least Once)

**Problem:** Flere steder bruges QoS 1, som kan resultere i duplikerede beskeder.

**Fil:** `nas-services/maaler-opsaetning/server.js` (linje 289, 329, 370, 405):
```javascript
mqttClient.publish(topic, payload, { qos: 1 }, (err) => { ... });
```

**Risiko:** Ved netværksproblemer kan en ON/OFF kommando sendes flere gange.

**Anbefaling:**
- [ ] Overvej QoS 2 (Exactly Once) for kritiske kommandoer
- [ ] Implementér idempotent kommandohåndtering

---

## 🔧 OPERATIONELLE SVAGHEDER (Prioritet 3)

### 9. Manglende Monitoring & Alerting

**Problem:** Ingen automatisk overvågning af:
- Container health
- MQTT broker status
- Zigbee controller forbindelse
- Supabase Edge Function fejl
- Database størrelse

**Anbefaling:**
- [ ] Implementér Prometheus + Grafana
- [ ] Tilføj Discord/Slack webhooks for alerts
- [ ] Overvåg kritiske services med Uptime Kuma

---

### 10. Manglende Backup Strategi

**Problem:** Ingen dokumenteret backup af:
- Z2M configuration.yaml (6 filer)
- Z2M device database
- Mosquitto data
- Home Assistant config

**Konsekvens:** Ved NAS-fejl skal ALT genopbygges manuelt.

**Anbefaling:**
- [ ] Automatisk daglig backup til ekstern lokation
- [ ] Versionskontrol af konfigurationsfiler
- [ ] Test restore-procedure regelmæssigt

---

### 11. Hardcoded Credentials

**Problem:** Flere steder har hardcoded MQTT credentials:

**Fil:** `nas-services/maaler-opsaetning/server.js` (linje 13-15):
```javascript
const MQTT_BROKER = 'mqtt://192.168.9.61:1890';
const MQTT_USERNAME = 'homeassistant';
const MQTT_PASSWORD = '7200Grindsted!';  // ⚠️ Hardcoded!
```

**Risiko:** Sikkerhedsproblem hvis kode deles.

**Anbefaling:**
- [ ] Flyt til miljøvariabler
- [ ] Brug Docker secrets

---

### 12. Ingen Graceful Degradation

**Problem:** Systemet har ingen fallback-mekanismer.

**Eksempler:**
- Hvis Supabase er nede → Frontend crasher
- Hvis MQTT er nede → Ingen strømstyring
- Hvis én Z2M instans er nede → Hele området er utilgængeligt

**Anbefaling:**
- [ ] Implementér offline-mode i frontend
- [ ] Cache seneste status lokalt
- [ ] Vis tydelige fejlbeskeder til brugere

---

## 📋 PRIORITERET HANDLINGSPLAN

### Fase 1: Kritiske Fixes (Denne uge)
1. ✅ Z2M availability konfiguration (DONE)
2. ⬜ Opdater device_sync.py til at synkronisere is_online
3. ⬜ Tilføj cleanup job for gamle "pending" meter_commands

### Fase 2: Stabilitet (Næste 2 uger)
4. ⬜ Implementér MQTT broker health-check
5. ⬜ Tilføj automatisk container restart ved fejl
6. ⬜ Opret backup-rutine for Z2M configs

### Fase 3: Skalerbarhed (Næste måned)
7. ⬜ Implementér data retention for meter_readings
8. ⬜ Tilføj monitoring dashboard
9. ⬜ Dokumentér disaster recovery procedure

### Fase 4: Sikkerhed (Løbende)
10. ⬜ Fjern hardcoded credentials
11. ⬜ Implementér rate limiting på API endpoints
12. ⬜ Tilføj audit logging

---

## 🎯 KONKLUSION

Det problem vi rettede i dag (Z2M ping cascade) viser vigtigheden af at analysere systemet grundigt. **En enkelt fejlkonfiguration kunne have gjort hele strømstyringssystemet ubrugeligt.**

De mest kritiske områder at adressere:

| Prioritet | Problem | Risiko | Kompleksitet |
|-----------|---------|--------|--------------|
| 🔴 Kritisk | MQTT = SPOF | Totalt nedbrud | Medium |
| 🔴 Kritisk | NAS = SPOF | Totalt nedbrud | Høj |
| 🟠 Høj | is_online ikke synkroniseret | Inkonsistent UI | Lav |
| 🟠 Høj | Ingen retry på kommandoer | Tabte kommandoer | Medium |
| 🟡 Medium | Database vækst | Langsom performance | Medium |
| 🟡 Medium | Ingen monitoring | Sen fejldetektion | Medium |

---

**Næste skridt:** Gennemgå denne analyse og prioriter hvilke punkter der skal adresseres først.
