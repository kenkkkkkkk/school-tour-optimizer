# Supabase migrations

## Opsætning (første gang)

1. Opret et nyt Supabase-projekt på https://supabase.com
2. Kopiér `Project URL`, `anon key` og `service_role key` fra
   Project Settings → API
3. Udfyld `.env.local` i projektroden med ovenstående nøgler
4. Kør migrations i rækkefølge via Supabase SQL Editor eller CLI:

```bash
# Via Supabase CLI (anbefalet)
supabase db push

# Eller kopiér-indsæt i SQL Editor:
#   0001_init.sql
#   0002_geocache.sql
```

## RLS-status

**Row Level Security er IKKE aktiveret** i MVP — appen kører åbent
internt uden auth. Før deployment skal RLS slås til på alle tabeller
og auth-policies defineres (separat migration).

## Hoteller

Hotellisten importeres fra Excel via:

```bash
npm run import-hotels -- path/to/hotelliste.xlsx
```

Scriptet geocoder alle hoteller (langsomt — ~200 hoteller × 1.1 sek
= ~4 min) og inserter dem i `hotels`-tabellen.
