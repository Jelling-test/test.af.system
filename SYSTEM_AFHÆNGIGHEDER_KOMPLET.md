# 🔗 Komplet Systemafhængigheds-Analyse

**Dato:** 15. december 2025  
**System:** Jelling Camping Strømstyringssystem

---

## 📊 ALLE SYSTEMKOMPONENTER

### CLOUD SERVICES (Eksternt hosted)

| # | Komponent | Placering | Funktion |
|---|-----------|-----------|----------|
| 1 | **Vercel (test-af-system)** | Cloud | Admin/Staff frontend |
| 2 | **Vercel (jelling.vercel.app)** | Cloud | Gæsteportal frontend |
| 3 | **Supabase Database** | Cloud | PostgreSQL database |
| 4 | **Supabase Edge Functions** | Cloud | 27 serverless funktioner |
| 5 | **Supabase Realtime** | Cloud | WebSocket live updates |
| 6 | **Stripe** | Cloud | Betalingshåndtering |
| 7 | **Resend** | Cloud | Email afsendelse |
| 8 | **Sirvoy** | Cloud | Booking system (webhook kilde) |

### LOKAL INFRASTRUKTUR (NAS 192.168.9.61)

| # | Komponent | Container/Service | Port | Funktion |
|---|-----------|-------------------|------|----------|
| 9 | **Mosquitto MQTT** | mosquitto | 1890 | Message broker |
| 10 | **device-sync.py** | device-sync | - | Supabase ↔ MQTT sync |
| 11 | **Z2M Area 1** | zigbee2mqtt-area1 | 8082 | Zigbee gateway |
| 12 | **Z2M Area 2** | zigbee2mqtt-area2 | 8083 | Zigbee gateway |
| 13 | **Z2M Area 3** | zigbee2mqtt-area3 | 8084 | Zigbee gateway |
| 14 | **Z2M Area 4** | zigbee2mqtt-area4 | 8085 | Zigbee gateway |
| 15 | **Z2M Area 5** | zigbee2mqtt-area5 | 8086 | Zigbee gateway |
| 16 | **Z2M Area 6** | zigbee2mqtt-area6 | 8087 | Zigbee gateway |
| 17 | **Home Assistant** | homeassistant | 8123 | Statistik/historik |
| 18 | **Telegraf** | telegraf | - | Metrics collection |

### HARDWARE

| # | Komponent | IP/Lokation | Funktion |
|---|-----------|-------------|----------|
| 19 | **Zigbee Controller 1** | 192.168.0.254:6638 | USB coordinator |
| 20 | **Zigbee Controller 2** | 192.168.1.35:6638 | USB coordinator |
| 21 | **Zigbee Controller 3** | 192.168.1.9:6638 | USB coordinator |
| 22 | **Zigbee Controller 4** | 192.168.1.66:6638 | USB coordinator |
| 23 | **Zigbee Controller 5** | 192.168.0.95:6638 | USB coordinator |
| 24 | **Zigbee Controller 6** | 192.168.0.60:6638 | USB coordinator |
| 25 | **~300 Strømmålere** | Zigbee mesh | Tongou målere |
| 26 | **NAS Hardware** | 192.168.9.61 | Synology/QNAP |

---

## 🔗 AFHÆNGIGHEDSMATRIX

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AFHÆNGIGHEDSKÆDE                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

BRUGER HANDLING          FRONTEND           BACKEND              LOKAL            HARDWARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Se Dashboard]    →    Vercel    →    Supabase DB    
                                           ↑
                                      device-sync    ←    MQTT    ←    Z2M    ←    Målere

[Tænd strøm]      →    Vercel    →    toggle-power    →    meter_commands
                                                                  ↓
                                                             device-sync    →    MQTT    →    Z2M    →    Måler

[Køb pakke]       →    Vercel    →    create-checkout    →    Stripe
                                           ↓
                                      stripe-webhook    →    Supabase DB

[Ny booking]      →    Sirvoy    →    webhook    →    Supabase DB
                                           ↓
                                      send-welcome-email    →    Resend

[Check-out]       →    Sirvoy    →    webhook    →    meter_commands
                                                            ↓
                                                       device-sync    →    MQTT    →    Z2M    →    OFF
```

---

## 🚨 DETALJERET FEJLSCENARIE-ANALYSE

### 1. VERCEL GÅR NED

**Afhængigheder til Vercel:**
- Admin UI (test-af-system.vercel.app)
- Staff UI
- Gæsteportal (jelling.vercel.app)

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Admin login | ❌ STOP |
| Staff login | ❌ STOP |
| Gæst login via magic link | ❌ STOP |
| Dashboard visning | ❌ STOP |
| Manuel strøm ON/OFF | ❌ STOP |
| Pakke køb fra portal | ❌ STOP |
| Kort/oversigt | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Målere → fortsætter i nuværende tilstand | ✅ OK |
| Automatisk check-out (webhook) | ✅ OK |
| Strømdata indsamling | ✅ OK |
| Advarsels-emails (scheduled) | ✅ OK |

**Opdagelse:** Besøg hjemmeside → fejlside
**Genopretning:** Vent på Vercel (automatisk)

---

### 2. SUPABASE DATABASE GÅR NED

**Afhængigheder til Supabase DB:**
- ALT frontend data
- Alle Edge Functions
- Kunde/booking data
- Pakke data
- Meter readings
- Kommandoer

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Frontend | ❌ CRASH (ingen data) |
| Nye bookings | ❌ STOP |
| Alle betalinger | ❌ STOP |
| Strøm ON/OFF kommandoer | ❌ STOP |
| Alle emails | ❌ STOP |
| device-sync | ❌ FEJLER |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Z2M lokalt | ✅ OK (kan styre via Z2M UI) |
| MQTT kommunikation | ✅ OK |
| Målere i nuværende tilstand | ✅ OK |

**Opdagelse:** Frontend viser ingen data, console errors
**Genopretning:** Vent på Supabase

---

### 3. SUPABASE EDGE FUNCTIONS FEJLER

**27 Edge Functions fordelt på kritiskhed:**

#### KRITISKE (stopper kernefunktionalitet):
| Funktion | Bruges til | Hvis den fejler |
|----------|------------|-----------------|
| `toggle-power` | Strøm ON/OFF | Kunder kan ikke styre strøm |
| `webhook` | Sirvoy integration | Nye bookings registreres ikke |
| `stripe-webhook` | Betalinger | Pakker oprettes ikke efter betaling |
| `create-checkout` | Start betaling | Kunder kan ikke købe pakker |
| `validate-magic-link` | Gæst login | Gæster kan ikke logge ind |

#### VIGTIGE (påvirker brugeroplevelse):
| Funktion | Bruges til | Hvis den fejler |
|----------|------------|-----------------|
| `send-welcome-email` | Velkomst mails | Kunder får ikke login link |
| `send-warning-email` | Advarsler | Kunder adviseres ikke om lav strøm |
| `check-low-power` | Overvågning | Ingen automatiske advarsler |
| `generate-magic-token` | Login links | Kan ikke generere nye links |
| `portal-api` | Gæstedata | Gæsteportal viser ingen data |

#### MINDRE KRITISKE:
| Funktion | Bruges til | Hvis den fejler |
|----------|------------|-----------------|
| `bakery-api` | Bageri | Bageri-bestilling fejler |
| `daily-accounting-report` | Rapporter | Ingen daglig rapport |
| `start/end-cleaning-power` | Hytte rengøring | Manuel håndtering nødvendig |

---

### 4. NAS (192.168.9.61) GÅR NED

**ALT på NAS stopper:**

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| MQTT Broker | ❌ NED |
| Alle 6 Z2M instanser | ❌ NED |
| device-sync | ❌ NED |
| Home Assistant | ❌ NED |
| Telegraf | ❌ NED |
| **AL strømstyring** | ❌ **TOTAL NEDBRUD** |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Vercel frontend | ✅ OK (viser gammel data) |
| Supabase | ✅ OK |
| Stripe betalinger | ✅ OK (men pakker virker ikke) |
| Målere | ⚠️ Forbliver i sidste tilstand |

**Opdagelse:** 
- Ping 192.168.9.61 fejler
- Frontend viser ingen real-time data
- Alle målere vises som "offline" efter timeout

**Genopretning:**
1. Fysisk tjek af NAS
2. Genstart NAS
3. Vent på Docker containers starter
4. Verificer alle services

---

### 5. MQTT BROKER (Mosquitto) GÅR NED

**Afhængigheder til MQTT:**
- Alle 6 Z2M instanser
- device-sync.py
- Home Assistant

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Z2M ↔ device-sync kommunikation | ❌ STOP |
| Strøm ON/OFF kommandoer | ❌ STOP |
| Meter data til Supabase | ❌ STOP |
| is_online status opdateringer | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Z2M UI (lokal) | ✅ OK |
| Zigbee mesh | ✅ OK |
| Supabase/Frontend | ✅ OK (gammel data) |

**Opdagelse:** `docker logs mosquitto` viser fejl
**Genopretning:** `docker restart mosquitto`

---

### 6. ÉN Z2M INSTANS GÅR NED (f.eks. Area 1)

**Påvirkning:** KUN målere i det specifikke område

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Målere i Area 1 | ❌ Ingen kommunikation |
| ON/OFF i Area 1 | ❌ STOP |
| Data fra Area 1 | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Alle andre områder | ✅ OK |
| Frontend/Backend | ✅ OK |
| MQTT | ✅ OK |

**Opdagelse:** Z2M UI på port 8082 svarer ikke
**Genopretning:** `docker restart zigbee2mqtt-area1`

---

### 7. ZIGBEE CONTROLLER HARDWARE FEJLER

**Påvirkning:** Alle målere tilknyttet den controller

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Alle målere på controller | ❌ OFFLINE |
| Z2M viser "Coordinator disconnected" | ❌ |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Alle andre controllers | ✅ OK |
| Alt software | ✅ OK |

**Opdagelse:** Z2M logs viser connection errors
**Genopretning:** 
1. Tjek USB kabel
2. Genstart controller
3. Evt. udskift med backup

---

### 8. DEVICE-SYNC GÅR NED

**Afhængigheder til device-sync:**
- meter_commands udførelse
- power_meters.is_online opdatering
- meter_identity synkronisering

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Strøm ON/OFF fra frontend | ❌ Kommandoer udføres ikke |
| is_online status | ❌ Opdateres ikke |
| Nye målere registreres | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Z2M lokal kontrol | ✅ OK |
| Frontend (gammel data) | ✅ OK |
| MQTT | ✅ OK |
| meter_readings (via HA) | ⚠️ Muligvis |

**Opdagelse:** 
- meter_commands forbliver "pending"
- Ingen nye målere i databasen

**Genopretning:** `docker restart device-sync`

---

### 9. STRIPE GÅR NED

**Afhængigheder til Stripe:**
- create-checkout (starter betaling)
- stripe-webhook (modtager bekræftelse)

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Kortbetalinger | ❌ STOP |
| Automatisk pakke-oprettelse | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Reception-betaling | ✅ OK |
| Alt andet | ✅ OK |

**Opdagelse:** Betalingsforsøg fejler
**Genopretning:** Brug reception-betaling, vent på Stripe

---

### 10. RESEND (EMAIL) GÅR NED

**Afhængigheder til Resend:**
- send-email
- send-welcome-email
- send-warning-email
- scheduled-emails

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Velkomst emails | ❌ STOP |
| Advarsel emails | ❌ STOP |
| Alle system emails | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Alt andet | ✅ OK |

**Opdagelse:** email_logs viser fejl
**Genopretning:** Vent på Resend, emails kan gensendes manuelt

---

### 11. SIRVOY WEBHOOK STOPPER

**Afhængigheder til Sirvoy:**
- Nye bookings
- Check-in/check-out
- Kunde data opdateringer

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Automatisk kunde-oprettelse | ❌ STOP |
| Automatisk check-out + strøm OFF | ❌ STOP |
| Hytte rengørings-schedule | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Eksisterende kunder | ✅ OK |
| Alt andet | ✅ OK |

**Opdagelse:** Nye bookings dukker ikke op
**Genopretning:** Manuel oprettelse af kunder, tjek Sirvoy webhook config

---

### 12. INTERNET FORBINDELSE TIL NAS FEJLER

**Hvad STOPPER:**
| Funktion | Status |
|----------|--------|
| Supabase ↔ NAS kommunikation | ❌ STOP |
| device-sync | ❌ FEJLER |
| Remote adgang | ❌ STOP |

**Hvad FORTSÆTTER:**
| Funktion | Status |
|----------|--------|
| Lokal Z2M kontrol | ✅ OK |
| MQTT lokalt | ✅ OK |
| Frontend/Supabase | ✅ OK (gammel data) |

**Opdagelse:** device-sync logs viser connection errors
**Genopretning:** Tjek router/netværk

---

## 📈 AFHÆNGIGHEDSKÆDER (Dataflow)

### Kæde 1: Strøm ON/OFF Kommando
```
Bruger klikker "Tænd"
    ↓
Vercel Frontend
    ↓
Supabase Edge Function (toggle-power)
    ↓
meter_commands tabel (status: pending)
    ↓
device-sync.py poller tabellen
    ↓
MQTT publish til Z2M topic
    ↓
Zigbee2MQTT modtager
    ↓
Zigbee Controller sender
    ↓
Måler modtager og tænder
    ↓
Måler sender bekræftelse tilbage
    ↓
Z2M → MQTT → device-sync
    ↓
meter_commands (status: completed)
```
**Antal led:** 11  
**Single Points of Failure:** 8

---

### Kæde 2: Ny Booking
```
Gæst booker via Sirvoy
    ↓
Sirvoy sender webhook
    ↓
Supabase Edge Function (webhook)
    ↓
regular_customers/seasonal_customers tabel
    ↓
approved_plates tabel
    ↓
(Hvis inden for X dage)
send-welcome-email
    ↓
Resend API
    ↓
Email til kunde
```
**Antal led:** 8  
**Single Points of Failure:** 4

---

### Kæde 3: Meter Reading Flow
```
Måler sender data hvert minut
    ↓
Zigbee mesh
    ↓
Zigbee Controller
    ↓
Zigbee2MQTT
    ↓
MQTT publish
    ↓
Home Assistant subscriber
    ↓
InfluxDB/Supabase
    ↓
meter_readings tabel
    ↓
Frontend query
    ↓
Dashboard visning
```
**Antal led:** 10  
**Single Points of Failure:** 6

---

## 🎯 KRITISK OPSUMMERING

### Mest Kritiske Komponenter (ved fejl = total nedbrud):

| Rang | Komponent | Påvirkning ved fejl |
|------|-----------|---------------------|
| 🔴 1 | **NAS Hardware** | ALT stopper |
| 🔴 2 | **MQTT Broker** | Ingen strømstyring |
| 🔴 3 | **Supabase** | Frontend + backend nede |
| 🟠 4 | **device-sync** | Kommandoer virker ikke |
| 🟠 5 | **Vercel** | Ingen brugeradgang |
| 🟡 6 | **Enkelt Z2M** | Kun ét område |
| 🟡 7 | **Stripe** | Kun betalinger |
| 🟢 8 | **Resend** | Kun emails |

### Redundans Status:

| Komponent | Redundans | Anbefaling |
|-----------|-----------|------------|
| NAS | ❌ INGEN | Sekundær NAS eller cloud backup |
| MQTT | ❌ INGEN | Cluster eller auto-restart |
| Z2M | ✅ 6 instanser | Allerede distribueret |
| Zigbee Controllers | ✅ 6 stk | Allerede distribueret |
| Supabase | ✅ CLOUD | Managed af Supabase |
| Vercel | ✅ CLOUD | Managed af Vercel |
| Stripe | ✅ CLOUD | Managed af Stripe |

---

**Konklusion:** NAS og MQTT er de mest kritiske single points of failure. Ved fejl i disse stopper AL strømstyring.

