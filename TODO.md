# TODO - Jelling Strømstyringssystem

**Sidst opdateret:** 27. november 2025

---

## 🔜 EFTER LINUX SERVER MIGRATION (~14 dage)

### Device Type System (Controllere/Repeatere)
**Prioritet:** Høj  
**Estimat:** 2-3 timer

Separér strømmålere fra controllere og repeatere i systemet.

**Database:**
- [ ] Opret ny tabel `zigbee_infrastructure` (ieee_address, friendly_name, device_type, ip, port, area, etc.)

**NAS - device_sync.py:**
- [ ] Tilføj check: `is_infrastructure_device(ieee, friendly_name)`
- [ ] Skip oprettelse i `power_meters` hvis enhed findes i `zigbee_infrastructure`
- [ ] Fil: `C:\Users\peter\Downloads\docker (5)\device-sync\device_sync.py`

**Admin Panel:**
- [ ] Ny sidebar: "Controllere" menu-punkt
- [ ] Ny side: `/admin/controllere`
- [ ] I Maalere.tsx: Tilføj "Flyt til controllere" i 3-prik menu
- [ ] I Controllere.tsx: "Omdøb", "Slet", "Flyt til målere"

**Enheder der skal klassificeres:**
- `0x180df9fffe9a69de` → Controller
- `0x781c9dfffee44952` → Controller  
- `repeater plads 225.230` → Repeater
- (+ 10-12 repeatere der kommer senere)

---

### Controller Automatisering
**Prioritet:** Høj  
**Estimat:** 4-8 timer

Automatisk opsætning af nye Zigbee2MQTT controllere via admin panel.

**Krav:**
- [ ] Database: `zigbee_controllers` tabel (area, ip, port, fw_version, status)
- [ ] Database: `controller_setup_queue` tabel (pending tasks)
- [ ] Database: `system_settings` udvidelse (firmware-anbefalinger)
- [ ] Backend: Controller Manager API (Docker socket adgang)
- [ ] Frontend: `/admin/controllers` side med:
  - Liste over eksisterende controllere
  - Tilføj ny controller formular
  - Firmware-anbefalinger (konfigurerbar)
  - Opsætningsguide

**Firmware-anbefalinger (nuværende):**
- SLZB-OS: v3.1.3
- Zigbee firmware: 20250220 (ember, SDK 8.0.2)
- Docker image: koenkk/zigbee2mqtt:latest
- Adapter: ember, rtscts: false

**Reference:** Se `forklaringer 24.11/opsætning af controller 27.11/SLZB-06M_KOMPLET_GUIDE.md`

---

## ✅ IMPLEMENTERET

### Hytte-modul (25. november 2025)
- [x] Database: `cabins` og `cabin_cleaning_schedule` tabeller
- [x] Webhook integration til booking-system
- [x] Auto tænd/sluk ved check-in/out
- [x] Rengørings-cron (10:00-15:00)
- [x] Admin side: `/admin/hytter`
- [x] Staff side: `/staff/hytter`

**Test checkliste (afventer):**
- [ ] Opret hytte i admin
- [ ] Modtag webhook for hytte-booking
- [ ] Verificer måler tildeles automatisk
- [ ] Verificer prepaid pakke oprettes
- [ ] Test check-in (strøm tænder)
- [ ] Test check-out (strøm slukker)
- [ ] Test rengørings-cron (10:00/15:00)
- [ ] Verificer camping-gæst IKKE kan vælge hytte-måler

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
