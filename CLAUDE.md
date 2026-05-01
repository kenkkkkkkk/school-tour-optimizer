# CLAUDE.md – Levende Musik i Skolen
# Turnéplanlægningsværktøj

> Denne fil læses automatisk af Claude Code ved opstart af hver session.

---

## 🏢 Om projektet

**Firma:** Levende Musik i Skolen (LMS)
**App-navn:** LMS Turnéplanner
**Formål:** Internt værktøj til at optimere turnéruter for musikgrupper på skolekoncerter i Danmark.
**Brugere:** Kun interne planlæggere (ca. 5-10 personer). Ingen offentlig adgang.

---

## 🛠️ Tech Stack

| Lag | Teknologi |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Kort | Leaflet + OpenStreetMap (gratis, open source) |
| Ruteberegning | OSRM API (gratis, open source) |
| Ruteoptimering | Nearest-neighbor + 2-opt algoritme (implementeret selv) |
| Deployment | Vercel |
| Pakkehåndtering | npm |

---

## 📁 Projektstruktur

```
/
├── app/
│   ├── page.tsx               # Forsiden / upload-skærm
│   ├── planner/               # Hoved-planlægningsside
│   │   ├── page.tsx           # Layout med kort + liste
│   │   └── [id]/              # Individuel turnévisning
│   └── api/
│       ├── optimize/          # Ruteoptimerings-endpoint
│       ├── hotels/            # Hotel-opslag endpoint
│       └── parse-excel/       # Excel-parsing endpoint
├── components/
│   ├── map/                   # Leaflet-kortkomponenter
│   │   ├── TourMap.tsx        # Hovedkort med skoler + rute
│   │   ├── SchoolMarker.tsx   # Nummereret markør pr. skole
│   │   └── HotelMarker.tsx    # Sløret hotel-markør
│   ├── sidebar/               # Højre-panel komponenter
│   │   ├── TourList.tsx       # Dragbar turnéliste
│   │   ├── DayGroup.tsx       # Gruppered pr. dag
│   │   └── SchoolItem.tsx     # Enkelt skole-element
│   └── ui/                    # Generiske UI-elementer
├── lib/
│   ├── excel/                 # Excel-parsing logik
│   │   └── parseTourtPlan.ts  # Konverterer Excel → internt format
│   ├── routing/               # Ruteoptimering
│   │   ├── osrm.ts            # OSRM API-klient
│   │   ├── optimizer.ts       # Optimeringsalgoritme
│   │   └── constraints.ts     # Forretningsregler / constraints
│   ├── hotels/                # Hotel-matchning
│   │   └── matcher.ts         # Matcher hotel til turné-dag
│   └── supabase/              # Database-klient
├── types/
│   ├── concert.ts             # Concert, School, TourDay typer
│   └── hotel.ts               # Hotel-typer
└── public/
```

---

## ⚡ Vigtige kommandoer

```bash
npm run dev          # Start udviklingsserver (http://localhost:3000)
npm run build        # Byg til produktion
npm run type-check   # TypeScript-tjek (INGEN fejl tilladt)
npm run lint         # ESLint-tjek
npm test             # Kør tests
```

> ✅ **Claude skal altid køre `npm run type-check` og `npm run lint`** efter ændringer og rette alle fejl, inden opgaven afsluttes.

---

## 📊 Dataformat – Excel-input (turnéplan)

Excel-filen der uploades har følgende nøglekolonner:

```
Dato              → Excel decimal-tid (f.eks. 46027.354) – skal konverteres til JS Date
Musikgruppe       → Bandets navn (f.eks. "Thomas Sandberg")
Spillested        → Skolens navn
Spillested - adresse → Adresse
Spillested - postnummer → Postnr (bruges til geocoding)
Spillested - by   → By
Spillested - område → F.eks. "Område 1 - Nord - Mads"
Spillested - kommune → Kommune
OBS               → Vigtige noter (special-aftaler, eldres årgange osv.)
```

**VIGTIGT – Excel datohåndtering:**
Excel gemmer datoer som decimaltal hvor heltallet = dage siden 1. jan 1900.
Decimaldelen = tid på dagen (0.5 = kl. 12.00, 0.375 = kl. 09.00).
Konverter altid via: `new Date((excelDate - 25569) * 86400 * 1000)`

**Besøgsskoler ignoreres** i ruteplanlægningen. Kun "Spillested" er relevant.

---

## 🏨 Dataformat – Hotelliste

Hotellisten indeholder 200+ hoteller med disse nøglefelter:

```
Hotel navn        → Hotellets navn
Adresse           → Gadenavn + husnummer
Postnr            → Postnummer
By                → By
Kommune           → Kommune
Område            → F.eks. "Område 2 - Kenneth" (matcher turnéens område)
Aftale            → "Ja"/"Nej" – om LMS har en aftale
Pris enkeltværelse → Kr. pr. nat
Checkin efter     → F.eks. "15:00"
Checkout før      → F.eks. "11:00"
Morgenmad         → "Ja"/"Nej"
Bemærkninger      → Vigtige noter
```

Hoteller med "(LUKKET)", "(BENYTTES IKKE)", eller "(OBS)" i navnet skal **filtreres fra**.

---

## 🎵 Forretningsregler (constraints)

Disse regler er centrale for optimeringsalgoritmen:

### Dage
- Koncerter afvikles **kun på hverdage** (mandag–fredag)
- Helligdage behandles som weekender

### Koncerter pr. dag
- Typisk **2 koncerter pr. dag**, maks. 3
- **Maks. 2 skoler pr. dag** – medmindre der er en aftenkoncert → da ok med 3 skoler
- Aftenkoncerter er næsten udelukkende på **efterskoler**

### Tidsplan
- Første koncert starter: **08:30–09:30**
- Sidste dagkoncert starter: **senest 12:00**
- Koncertvarighed: **45 minutter**
- Op/nedtagning: **30–40 min** (varierer 10–60 min)
- Buffer til kørsel mellem skoler skal altid medregnes

### Skole-typer
- Folkeskoler: Kun dagtimekoncerter
- Efterskoler: Kan have aftenkoncerter (eleverne bor der)

### Optimeringsmål
- Minimér **total køredistance** (km)
- Hold **geografisk sammenhæng** dag for dag
- Undgå "pingpong"-ruter (eks. Esbjerg mandag → Frederikshavn tirsdag → Ringkøbing onsdag)

---

## 🗺️ Kort og hotel-logik

### Kortvisning
- Skoler vises som **nummererede farvede markører** (farve = dag)
- Hoteller vises som **slørede/dæmpede H-ikoner** som permanent lag
- Ruten tegnes som stiplet linje mellem skolerne
- Musikernes bopæl vises som hus-ikon

### Hotel-matching
1. Algoritmen optimerer skoleruten **uden** hoteller først
2. Identificér hvilke aftener der kræver overnatning (næste dags skoler er >X km væk)
3. Find nærmeste samarbejdshotel i samme "Område" som dagens koncerter
4. Foreslå hotellet – planlægger kan klikke på et andet hotel på kortet
5. Hoteller der er markeret LUKKET eller BENYTTES IKKE filtreres fra

---

## 📏 Koderegler

- Skriv **altid TypeScript** – aldrig `any`
- Brug **async/await** – aldrig `.then()`-chaining
- Håndtér altid fejl med `try/catch` i async-funktioner
- Tilføj kommentarer på **dansk** ved kompleks logik
- Maks. **50 linjer** pr. funktion

### Navngivning
- Komponenter: `PascalCase` (eks. `TourMap.tsx`)
- Funktioner/variabler: `camelCase` (eks. `parseTourDate`)
- Konstanter: `UPPER_SNAKE_CASE` (eks. `MAX_CONCERTS_PER_DAY`)
- Filer: `kebab-case` undtagen komponenter

---

## 🔐 Sikkerhedsregler

- ❌ Commit **aldrig** `.env.local` eller API-nøgler til Git
- ❌ Commit **aldrig** direkte til `main`-branchen
- ✅ Brug altid feature-branches: `git checkout -b feature/[navn]`
- ✅ `.env.local` skal stå i `.gitignore`

### Miljøvariabler (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 🚫 Ting Claude IKKE må gøre

- Må ikke foreslå at slette eksisterende kode uden eksplicit bekræftelse
- Må ikke installere nye npm-pakker uden at nævne og begrunde det
- Må ikke antage at en opgave er løst – kør altid `type-check` og `lint`
- Må ikke hardkode koordinater – brug altid adresser og geocoding

---

## 📝 Changelog

| Dato | Ændring |
|---|---|
| 2026-04-22 | Projekt oprettet – initial CLAUDE.md |
