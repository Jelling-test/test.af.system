# TODO - Jelling Strømstyringssystem

**Sidst opdateret:** 4. december 2025

---

## 📧 EMAIL SYSTEM & MAGISKE LINKS (I GANG)

### Status
**Prioritet:** Høj  
**Status:** Database og Edge Function oprettet - mangler test og UI

### Implementeret ✅
- [x] Database tabel: `email_providers` (multi-provider support)
- [x] Database tabel: `email_logs` (sporing af sendte mails)
- [x] Edge Function: `send-email-v2` (SMTP support)
- [x] Support for: Gmail, Simply.com, andre SMTP-udbydere
- [x] Konfigurérbar sikkerhed (TLS/SSL/none)

### Mangler 🔲
- [ ] Admin UI til at konfigurere email-udbydere
- [ ] Test af email-afsendelse
- [ ] Magiske login-links (passwordless login)
- [ ] QR-kode generering

### Magiske Links - Sådan skal det virke

**Flow for gæst:**
1. Gæst modtager booking-bekræftelse med **unikt magisk link**
2. Link format: `https://app.jfrv.dk/guest?token=abc123xyz`
3. Token er knyttet til `booking_nummer` i databasen
4. Når gæst klikker → auto-login til deres Dashboard
5. Ingen password nødvendigt

**Database ændringer nødvendige:**
```sql
-- Tilføj til customer_sessions eller ny tabel
CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_nummer TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  used_at TIMESTAMPTZ,
  FOREIGN KEY (booking_nummer) REFERENCES customer_sessions(booking_nummer)
);
```

**Edge Function: `create-magic-link`**
- Generér unikt token (32+ chars)
- Gem i database med booking_nummer
- Returnér fuld URL

**Edge Function: `verify-magic-link`**
- Modtag token fra URL
- Tjek om gyldigt og ikke udløbet
- Returnér booking_nummer
- Markér som brugt (valgfrit - kan genbruges)

### QR-koder

**Brug:**
- Print QR-kode på velkomstbrev
- Gæst scanner → åbner magisk link
- Auto-login til Dashboard

**Generering:**
- Brug `qrcode` npm pakke i frontend
- Eller server-side med Edge Function

### Email Templates

**Booking bekræftelse skal indeholde:**
```
Velkommen til Jelling Camping!

Din booking: {booking_nummer}
Plads: {plads_nummer}
Ankomst: {start_dato}
Afrejse: {slut_dato}

🔗 Klik her for at styre din strøm:
{magic_link}

Eller scan QR-koden på dit velkomstbrev.
```

---

## 🔜 EFTER LINUX SERVER MIGRATION (~14 dage)

### Raspberry Pi MQTT Monitor
**Prioritet:** Høj  
**Estimat:** 2-3 timer  
**Hardware:** Raspberry Pi 4 (2GB) ~400 kr

Lokal overvågning af MQTT broker med alarm til telefon.

**Opsætning:**
- [ ] Køb Raspberry Pi 4 (2GB)
- [ ] Installer Uptime Kuma
- [ ] Konfigurer MQTT health-check
- [ ] Opsæt UniFi Protect push-notifikation ved fejl
- [ ] Test alarm-flow

**Fordele:**
- Kører uafhængigt af Linux server
- Virker uden internet
- Push-notifikation til telefon via UniFi app

---

## 📅 DEADLINE: UGE 11 (Marts 2026)

### Sammenbygning med Main Projekt
**Prioritet:** Mellem  
**Deadline:** Uge 11, 2026

Sammenbygning af strømstyring med hovedprojektet.

**Projekter:**
- **Strømstyring:** `jkmqliztlhmfyejhmuil`
- **Main projekt:** `lxrqtuhvvroplewkamnk`

**Opgaver:**
- [ ] Analysér datastruktur i begge projekter
- [ ] Plan for migration/integration
- [ ] Implementér sammenbygning
- [ ] Test

---

## ✅ IMPLEMENTERET

### Hytte-modul (25. november 2025) ✅ TESTET & VIRKER
- [x] Database: `cabins` og `cabin_cleaning_schedule` tabeller
- [x] Webhook integration til booking-system
- [x] Auto tænd/sluk ved check-in/out
- [x] Rengørings-cron (10:00-15:00)
- [x] Admin side: `/admin/hytter`
- [x] Staff side: `/staff/hytter`
- [x] Opret hytte i admin
- [x] Modtag webhook for hytte-booking
- [x] Verificer måler tildeles automatisk
- [x] Verificer prepaid pakke oprettes
- [x] Test check-in (strøm tænder)
- [x] Test check-out (strøm slukker)
- [x] Test rengørings-cron (10:00/15:00)
- [x] Verificer camping-gæst IKKE kan vælge hytte-måler

### Kort-modul (30. november 2025) ✅
- [x] Baggrundskort upload
- [x] Drag & drop elementer (standere, hytter, pladser, repeatere)
- [x] Dato-filter for bookinger
- [x] Kundedata ved klik på plads/hytte
- [x] Måler-info i modaler
- [x] Vinteropbevaring (lilla farve)
- [x] Webhook gemmer vinteropbevaring automatisk
- [x] Print funktion
- [x] Zoom/pan (virker også når låst)

---

## 📝 NOTER

### Linux Server Migration
- Planlagt: ~14 dage fra nu
- Alle Docker containers flyttes fra NAS til Linux
- Controller automatisering implementeres EFTER migration
- Fordel: Alt kører lokalt, ingen cloud-kommunikation nødvendig

### Controller IP'er (nuværende)
| Område | IP | Port |
|--------|-----|------|
| 1 | 192.168.0.254 | 8082 |
| 2 | 192.168.1.35 | 8083 |
| 3 | 192.168.1.9 | 8084 |
| 4 | 192.168.1.66 | 8085 |
| 5 | 192.168.0.95 | 8086 |
| 6 | 192.168.0.60 | 8087 |
