# Hytte-modul Implementation - 25. november 2025

## STATUS: IMPLEMENTERET ✅

## Oversigt
Dette dokument beskriver alle ændringer foretaget som del af hytte-modul implementeringen.

---

## DATABASE ÆNDRINGER (Supabase)

### Ny tabel: `cabins`
```sql
CREATE TABLE cabins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabin_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cabin_type TEXT,
  meter_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Formål:** Mapper hytte-numre til faste strømmålere.

**Rollback:**
```sql
DROP TABLE IF EXISTS cabins;
```

---

### Ny tabel: `cabin_cleaning_schedule`
```sql
CREATE TABLE cabin_cleaning_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabin_id UUID REFERENCES cabins(id),
  meter_id TEXT NOT NULL,
  checkout_date DATE NOT NULL,
  cleaning_start TIMESTAMPTZ NOT NULL,
  cleaning_end TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Formål:** Styrer automatisk rengørings-strøm (10:00-15:00) på checkout-dage.

**Rollback:**
```sql
DROP TABLE IF EXISTS cabin_cleaning_schedule;
```

---

## EDGE FUNCTIONS ÆNDRINGER

### Opdateret: `supabase/functions/webhook/index.ts`
**Ændringer:**
- Tilføjet hytte-identifikation (slår RoomName op i cabins tabel)
- Automatisk måler-tildeling for hytter
- Oprettelse af prepaid pakke: "Energipakke X dage - refunderes ikke ved ikke brugt"
- Auto-tænd ved check-in
- Auto-sluk ved check-out + opret cleaning schedule

**Original fil backup:** `webhook/index.ts.backup.25.11`

---

### Ny: `supabase/functions/start-cleaning-power/index.ts`
**Formål:** Cron job der kører kl. 10:00 - tænder strøm på hytter med checkout.

---

### Ny: `supabase/functions/end-cleaning-power/index.ts`
**Formål:** Cron job der kører kl. 15:00 - slukker strøm på hytter uden ny gæst.

---

## FRONTEND ÆNDRINGER

### Ny side: `src/pages/admin/Hytter.tsx`
**Formål:** Admin-interface til at oprette, redigere og slette hytter.

### Opdateret: `src/pages/VaelgMaaler.tsx`
**Ændring:** Filtrerer hytte-målere fra søgeresultater.

### Opdateret: `src/pages/admin/Maalere.tsx`
**Ændring:** Viser "Hytte-låst" badge på hytte-målere.

### Opdateret: `src/pages/admin/Kunder.tsx`
**Ændringer:**
- Filtrerer hytte-målere fra manuel tildeling
- Tilføjer "Fjern prepaid pakke" funktion

### Opdateret: `src/App.tsx`
**Ændring:** Tilføjer route for `/admin/hytter`.

---

## ROLLBACK PROCEDURE

### Trin 1: Database
```sql
-- Slet nye tabeller
DROP TABLE IF EXISTS cabin_cleaning_schedule;
DROP TABLE IF EXISTS cabins;
```

### Trin 2: Edge Functions
- Slet `start-cleaning-power` og `end-cleaning-power` fra Supabase Dashboard
- Gendan `webhook/index.ts` fra backup

### Trin 3: Frontend
- Erstat hele `lokal backup 25.11` mappen med `lokal backup 22.11`
- Geninstaller: `npm install`
- Genbyg: `npm run build`

---

## TEST CHECKLISTE

- [ ] Opret hytte i admin
- [ ] Modtag webhook for hytte-booking
- [ ] Verificer måler tildeles automatisk
- [ ] Verificer prepaid pakke oprettes
- [ ] Test check-in (strøm tænder)
- [ ] Test check-out (strøm slukker)
- [ ] Test rengørings-cron (10:00/15:00)
- [ ] Verificer camping-gæst IKKE kan vælge hytte-måler

---

## KONTAKT
Ved problemer: Se original backup i `lokal backup 22.11`
