# Email Provider System - Restore Guide

## 📅 Dato: 2024-12-04

Denne guide beskriver hvordan du kan rulle tilbage til det originale Brevo-only system hvis det nye multi-provider system fejler.

---

## 🔥 Hurtig Restore (5 min)

### Metode 1: Via Supabase Dashboard

1. **Slet email_provider_config tabellen:**
   ```sql
   DROP TABLE IF EXISTS email_provider_config CASCADE;
   ```

2. **Geninstaller original send-email:**
   - Omdøb `send-email/index.ts.backup` → `send-email/index.ts`
   - Deploy: `npx supabase functions deploy send-email --no-verify-jwt`

### Metode 2: Manuel Restore af Filer

Alle originale filer er gemt som `.backup`:

| Original fil | Backup fil |
|--------------|------------|
| `send-email/index.ts` | `send-email/index.ts.backup` |
| `send-low-power-warning/index.ts` | `send-low-power-warning/index.ts.backup` |
| `daily-accounting-report/index.ts` | `daily-accounting-report/index.ts.backup` |

**Restore steps:**
```powershell
# I supabase/functions mappen:
cd send-email
del index.ts
ren index.ts.backup index.ts

# Gentag for andre funktioner hvis nødvendigt
```

---

## 📦 Hvad blev ændret?

### Database
- Ny tabel: `email_provider_config`
- Trigger: `ensure_single_active_email_provider`
- Default provider: Brevo (aktiv)

### Edge Functions
- `send-email` - Opdateret til multi-provider (SMTP + REST API)
- Andre funktioner kalder stadig `send-email` (ingen ændring)

### Frontend
- `Indstillinger.tsx` - Ny "Email Provider" sektion

---

## 🔧 Deployment Kommandoer

### Deploy ny version:
```powershell
# Fra projekt-root
npx supabase functions deploy send-email --no-verify-jwt
```

### Push til GitHub → Vercel:
```powershell
git add .
git commit -m "Email provider system opdatering"
git push origin main
```

---

## ⚠️ Fejlfinding

### "No active email provider configured"
**Problem:** Ingen aktiv provider i databasen.

**Løsning:**
```sql
-- Tjek om der er providers
SELECT * FROM email_provider_config;

-- Aktivér Brevo som default
UPDATE email_provider_config SET is_active = true WHERE name = 'Brevo';
```

### SMTP fejl (Gmail/Simply)
**Problem:** Authentication failed

**Tjek:**
1. Gmail: Bruger du App Password (ikke normal password)?
2. Simply: Bruger du `websmtp.simply.com` (ikke `smtp.simply.com`)?
3. Port: 587 med TLS

### Brevo/REST API fejl
**Problem:** API key not configured

**Løsning:**
1. Tjek at BREVO_API_KEY er sat i Supabase secrets
2. Eller opdater provider config med direkte API key

---

## 📞 Support

Hvis du har problemer:
1. Tjek Supabase Edge Function logs
2. Tjek browser console for fejl
3. Kontakt udvikleren

---

## 🗂️ Fil Struktur

```
supabase/functions/
├── send-email/
│   ├── index.ts              # NY: Multi-provider version
│   └── index.ts.backup       # BACKUP: Original Brevo-only
├── send-email-v2/
│   └── index.ts              # Kan slettes (kopi af send-email)
├── send-low-power-warning/
│   ├── index.ts              # Uændret (kalder send-email)
│   └── index.ts.backup       # BACKUP: Original
└── daily-accounting-report/
    ├── index.ts              # Uændret (kalder send-email direkte)
    └── index.ts.backup       # BACKUP: Original
```
