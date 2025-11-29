# 📋 MASTER PLAN: Jelling Camping Strømstyring

**Oprettet:** 29. november 2025  
**Status:** Aktiv arbejdsplan  
**System:** 300+ Zigbee strømmålere fordelt på 6 områder

---

# 🔄 TODO: Afventende Opgaver (Før den kritiske fejl)

Vi var i gang med følgende opgaver før vi opdagede den kritiske Z2M ping-fejl:

## Igangværende
- [ ] **Synkronisering af is_online status** - device_sync.py opdaterer IKKE `power_meters.is_online` fra Z2M availability
- [ ] **Frontend viser forkert online-status** - Alle målere viser "online" selvom de er offline i Z2M

## Planlagte
- [ ] **Færdiggør opsætning af område 4-5-6** - Antennerne ligger på bordet, skal monteres fysisk
- [ ] **Test webhook fra Sirvoy** - Automatisk check-in/check-out flow
- [ ] **Dokumenter hele systemet** - Mangler komplet dokumentation

---

# ✅ FULDFØRT I DAG (29. nov)

- [x] **Identificeret kritisk Z2M ping cascade problem**
- [x] **Implementeret fix med `pause_on_backoff_gt: 15`**
- [x] **Testet på zigbee2mqtt (Kontor måler)**
- [x] **Uploadet config til alle 6 områder**
- [x] **Verificeret konfigurationsfiler fra NAS**

---

# 🔍 SYSTEM SVAGHEDER - KOMPLET ANALYSE

## Baseret på kode-analyse + online research

---

## 🚨 KRITISK NIVEAU (Kan forårsage totalt nedbrud)

### 1. ✅ Z2M Ping Cascade [RETTET]
**Problem:** Offline enheder blev pinget uendeligt, overbelastede netværket.  
**Status:** Rettet med `pause_on_backoff_gt: 15`  
**Kilde:** Egen erfaring + [Z2M dokumentation](https://www.zigbee2mqtt.io/guide/configuration/device-availability.html)

### 2. ⚠️ MQTT Broker = Single Point of Failure
**Problem:** Mosquitto er en enkelt instans uden redundans.  
**Konsekvens:** Hvis Mosquitto crasher, stopper ALT:
- Alle 6 Z2M instanser
- device-sync.py
- Strømkommandoer
- Data-indsamling

**Fra online research:**
> "Mosquitto understøtter IKKE native clustering. For High Availability kræves HiveMQ, EMQX eller Cedalo Pro Mosquitto."
> — [Cedalo MQTT HA Documentation](https://cedalo.com/mqtt-broker-pro-mosquitto/high-availability/)

**Mulige løsninger:**
1. **Kort sigt:** Tilføj automatisk container-genstart ved fejl
2. **Mellem sigt:** Implementér health-check med alerting
3. **Lang sigt:** Overvej EMQX eller HiveMQ cluster

### 3. ⚠️ NAS = Single Point of Failure
**Problem:** AL kritisk infrastruktur kører på én NAS (192.168.9.61)  
**Konsekvens:** NAS-nedbrud = komplet systemfejl

**Løsninger:**
1. Automatisk backup af configs til ekstern lokation
2. Dokumentér disaster recovery procedure
3. Overvej sekundær NAS for kritiske services

### 4. ⚠️ is_online Synkroniseres IKKE til Database
**Fil:** `device-sync/device_sync.py`  
**Problem:** Scriptet gemmer `availability` i `meter_identity`, men opdaterer ALDRIG `power_meters.is_online`

**Konsekvens:**
- Frontend viser altid "online" (default værdi)
- Brugere kan ikke se reelle offline-status
- Inkonsistens mellem Z2M UI og webapp

**Fix påkrævet:**
```python
# Tilføj i upsert_power_meter():
is_online = availability == "online" if availability else True
payload["is_online"] = is_online
```

### 5. ⚠️ Ingen Retry/Timeout på Strømkommandoer
**Fil:** `supabase/functions/toggle-power/index.ts`  
**Problem:** Kommandoer indsættes i `meter_commands` med status "pending", men:
- Ingen timeout-håndtering
- Ingen automatisk retry ved fejl
- Ingen cleanup af gamle pending-kommandoer
- Ingen feedback til bruger hvis kommando fejler

**Løsning:** 
- Tilføj `created_at` timestamp og timeout-logik
- Implementér retry-mekanisme
- Tilføj cron-job til cleanup

---

## ⚡ HØJ PRIORITET (Performance/Stabilitet)

### 6. Database Vækst (meter_readings)
**Problem:** Tabellen vokser eksponentielt:
- 300 målere × 1 msg/min × 1440 min/dag = **432.000 rows/dag**
- **13 millioner rows/måned**
- **156 millioner rows/år**

**Fra online research:**
> "For time-series data i Supabase, overvej TimescaleDB extension og implementer data retention policies."
> — [Supabase TimescaleDB Docs](https://supabase.com/docs/guides/database/extensions/timescaledb)

**Løsninger:**
1. Implementér data retention (slet data ældre end X dage)
2. Aktivér TimescaleDB extension for automatisk komprimering
3. Tilføj indexes på (meter_id, time)

### 7. Zigbee Mesh Broadcast Overload
**Fra Z2M dokumentation:**
> "Zigbee can only sustain an average rate of 1 broadcast per second, and multiple broadcasts within a short timespan increases latency."
> — [Z2M Network Stability Guide](https://www.zigbee2mqtt.io/advanced/zigbee/02_improve_network_range_and_stability.html)

**Problem:** Med 300+ enheder kan broadcast-trafik overbelaste netværket.

**Løsninger:**
1. Undgå Zigbee Groups med mange enheder
2. Minimér firmware-opdateringer i peak-timer
3. Overvåg `messages_per_sec` i Z2M health logs

### 8. Zigbee Kanal-Interferens med Wi-Fi
**Fra online research:**
> "As Wi-Fi and Zigbee both operate on the same frequency space (2.4 GHz), they can interfere with each other."

**Nuværende kanaler:**
| Område | Kanal |
|--------|-------|
| Area 1 | (default 11) |
| Area 2 | 20 |
| Area 3 | 11 |
| Area 4 | 11 |
| Area 5 | 11 |
| Area 6 | 11 |

**Potentiel risiko:** Hvis Wi-Fi bruger kanal 1-6, kan der være interferens med Zigbee kanal 11.

**Anbefaling:**
- Tjek hvilke Wi-Fi kanaler der bruges på campingpladsen
- Overvej at flytte nogle områder til kanal 25-26 (mindst Wi-Fi interferens)

### 9. Coordinator Hardware Belastning
**Fra Z2M dokumentation:**
> "The pinging can be heavy on the coordinator, especially if you are using a CC2530 or CC2531 adapter. Higher timeout for active devices results in less pinging so less stress on the coordinator."

**Nuværende setup:** Ember-baserede adaptere (god performance)  
**Status:** OK, men monitorer ved vækst

---

## 🟡 MELLEM PRIORITET (Vedligeholdelse)

### 10. Ingen Automatisk Monitoring/Alerting
**Problem:** Ingen automatisk overvågning af:
- Container health status
- MQTT broker tilgængelighed
- Zigbee controller forbindelse
- Database størrelse
- Edge function fejl

**Løsning:** Implementér:
- Uptime Kuma for service monitoring
- Discord/Slack webhooks for alerts
- Prometheus + Grafana dashboards

### 11. Hardcoded Credentials
**Fil:** `nas-services/maaler-opsaetning/server.js` (linje 13-15)
```javascript
const MQTT_PASSWORD = '7200Grindsted!';  // Sikkerhedsrisiko!
```

**Løsning:** Flyt til miljøvariabler eller Docker secrets

### 12. Manglende Backup Strategi
**Problem:** Ingen dokumenteret backup af:
- Z2M configuration.yaml (×6)
- Z2M device database
- Mosquitto persistence data
- Home Assistant config

**Løsning:** 
- Automatisk daglig backup til ekstern NAS/cloud
- Git-versionskontrol af configs
- Test restore-procedure månedligt

### 13. Ingen Graceful Degradation
**Problem:** Systemet har ingen fallback:
- Supabase nede → Frontend crasher
- MQTT nede → Ingen strømstyring
- Én Z2M nede → Hele området utilgængeligt

**Løsning:**
- Cache seneste status lokalt i frontend
- Vis tydelige fejlbeskeder
- Implementér offline-mode

---

## 🟢 LAV PRIORITET (Optimering)

### 14. MQTT QoS Inkonsistens
Nogle steder bruges QoS 0, andre QoS 1. Standardiser til QoS 1 for pålidelig levering.

### 15. Log Rotation
Z2M og Mosquitto logs kan vokse. Implementér automatisk rotation.

### 16. Dokumentation
Mangler:
- Arkitektur-diagram
- Runbook for fejlsøgning
- Onboarding-guide for nye udviklere

---

# 📊 ANDRE BRUGERES ERFARINGER (Online Research)

## Fra GitHub Issues og Reddit

### Problem: "All devices appear offline after Z2M upgrade"
> "After updating to Zigbee2MQTT 2.2.0, all zigbee devices appear offline in HA!"
> — [GitHub Issue #26942](https://github.com/Koenkk/zigbee2mqtt/issues/26942)

**Løsning:** Genstart Z2M, vent på devices check-in, eller sæt højere timeout.

### Problem: "Network slow with 100+ devices"
> "I have a network of 86 devices... The coordinator crashes several times a month."
> — [GitHub Issue #5110](https://github.com/Koenkk/zigbee2mqtt/issues/5110)

**Løsning:** 
- Brug bedre coordinator (Ember i stedet for CC2531)
- Tilføj routers (mains-powered devices)
- Reducer ping-frekvens

### Problem: "ZCL error timeouts"
> "It all started with the update to 1.39 z2m... ZCL error timeouts, network slowed down"
> — [GitHub Issue #25945](https://github.com/Koenkk/zigbee2mqtt/issues/25945)

**Løsning:** Tjek for firmware-problemer, reducer broadcast-trafik.

### Anbefaling fra erfarne brugere:
> "I have over 100 Zigbee devices in my network, so I changed the Timeout value for Active devices to 30 minutes... This reduces the load on my Zigbee network."
> — [Home Automation Guy](https://www.homeautomationguy.io/blog/managing-offline-devices-in-zigbee2mqtt)

---

# 🎯 PRIORITERET HANDLINGSPLAN

## Fase 1: Kritiske Fixes (Denne uge)
| # | Opgave | Tid | Status |
|---|--------|-----|--------|
| 1 | ✅ Z2M availability config | 2t | DONE |
| 2 | Fix device_sync.py is_online | 1t | TODO |
| 3 | Tilføj cleanup job for pending kommandoer | 2t | TODO |
| 4 | Genstart area2 + area3 containere | 15m | TODO |

## Fase 2: Stabilitet (Næste 2 uger)
| # | Opgave | Tid | Status |
|---|--------|-----|--------|
| 5 | MQTT broker health-check + alerting | 4t | TODO |
| 6 | Automatisk container restart ved fejl | 2t | TODO |
| 7 | Backup-rutine for Z2M configs | 2t | TODO |
| 8 | Montér antenne område 4-5-6 | - | VENTER |

## Fase 3: Skalerbarhed (Næste måned)
| # | Opgave | Tid | Status |
|---|--------|-----|--------|
| 9 | Data retention for meter_readings | 4t | TODO |
| 10 | Monitoring dashboard (Uptime Kuma) | 4t | TODO |
| 11 | Dokumentér disaster recovery | 4t | TODO |

## Fase 4: Sikkerhed (Løbende)
| # | Opgave | Tid | Status |
|---|--------|-----|--------|
| 12 | Fjern hardcoded credentials | 2t | TODO |
| 13 | Implementér rate limiting | 2t | TODO |
| 14 | Tilføj audit logging | 4t | TODO |

---

# 📎 NYTTIGE LINKS

## Dokumentation
- [Z2M Device Availability](https://www.zigbee2mqtt.io/guide/configuration/device-availability.html)
- [Z2M Network Stability](https://www.zigbee2mqtt.io/advanced/zigbee/02_improve_network_range_and_stability.html)
- [Supabase TimescaleDB](https://supabase.com/docs/guides/database/extensions/timescaledb)
- [MQTT High Availability](https://cedalo.com/mqtt-broker-pro-mosquitto/high-availability/)

## GitHub Issues (Reference)
- [Z2M #26942 - Offline after upgrade](https://github.com/Koenkk/zigbee2mqtt/issues/26942)
- [Z2M #5455 - Large networks 100+ devices](https://github.com/Koenkk/zigbee2mqtt/discussions/5455)
- [Z2M #5110 - Network crashes](https://github.com/Koenkk/zigbee2mqtt/issues/5110)

---

# 📝 NOTER TIL NÆSTE SESSION

1. **Start med:** Genstart zigbee2mqtt_area2 og zigbee2mqtt_area3
2. **Derefter:** Fix device_sync.py så is_online synkroniseres
3. **Husk:** Område 4-5-6 er stoppet indtil antennerne er monteret
4. **Test:** Webhook fra Sirvoy til automatisk check-in

---

**Sidst opdateret:** 29. november 2025, kl. 09:00
