# LMS Turnéplanner – Projektspecifikation

**Firma:** Levende Musik i Skolen  
**Dato:** April 2026  
**Version:** 1.0

---

## 1. Formål

Et internt webværktøj til ruteplanlægning af musikgruppers skolekoncertturnéer i Danmark. Appen minimerer køredistance og foreslår hotelovernatninger baseret på en uploadet Excel-fil med koncertdata.

---

## 2. Brugerflow

```
1. Planlægger uploader Excel-fil med turnédata
2. App parser filen og viser alle spillesteder på et danmarkskort
3. Optimeringsalgoritmen beregner den korteste rute
4. Resultatet vises: kort til venstre, dragbar liste til højre
5. Planlægger kan trække og slippe skoler for at justere rækkefølgen
6. Km-total og dag-km opdaterer sig live ved justeringer
7. App foreslår hotelovernatninger på relevante aftener
8. Planlægger kan klikke på alternative hoteller på kortet
```

---

## 3. UI-layout

```
┌─────────────────────────────┬──────────────────────┐
│  HEADER: Logo | Km-total | Upload-knap | Status    │
├─────────────────────────────┼──────────────────────┤
│                             │  Sidebar              │
│  Kort (Leaflet +            │  ┌─ Mandag 6. jan ──┐ │
│  OpenStreetMap)             │  │ ⠿ 1 Vestbjerg     │ │
│                             │  │ ⠿ 2 Lindholm      │ │
│  Nummererede skole-         │  └───────────────────┘ │
│  markører (farve = dag)     │  ┌─ Tirsdag 7. jan ─┐ │
│                             │  │ ⠿ 3 Bjerringbro   │ │
│  Slørede hotel-ikoner       │  │ ⠿ 4 Ans           │ │
│                             │  └───────────────────┘ │
│  Stiplet rute-linje         │                       │
│                             │  [Genoptimér-knap]   │
│  Hus-ikon = bopæl           │                       │
├─────────────────────────────┼──────────────────────┤
│  Footer: Total km | Antal koncerter | Hotel-nætter │
└────────────────────────────────────────────────────┘
```

---

## 4. Excel-parsing

### Input-format (turnéplan)
Nøglekolonner der læses:
- `Dato` → Excel decimaltid → konverteres til JS Date
- `Musikgruppe` → Bandets navn
- `Spillested` → Skolens navn (bruges som visningsnavn)
- `Spillested - adresse`, `postnummer`, `by` → Bruges til geocoding
- `Spillested - område` → F.eks. "Område 2 - Kenneth"
- `Spillested - kommune`
- `OBS` → Særlige bemærkninger (vises i UI)

### Datokonvertering
Excel gemmer datoer som dage siden 1. jan 1900.
```typescript
const excelDateToJS = (excelDate: number): Date => {
  return new Date((excelDate - 25569) * 86400 * 1000);
}
```

### Gruppering
Efter parsing grupperes koncerterne:
1. Per dag (baseret på dato-dato uden tid)
2. Per skole inden for dagen (samme spillested = samme skole)

### Besøgsskoler
Kolonnerne "Besøgsskole 1" og "Besøgsskole 2" **ignoreres** – kun spillesteder er relevante for ruten.

---

## 5. Hotelliste-import

Hotellisten indlæses fra en separat Excel-fil og gemmes i databasen.

### Filtrering
Hoteller med følgende strenge i navnet **udelades**:
- `(LUKKET)`, `(lukket)`, `Lukket`
- `(BENYTTES IKKE)`, `BENYTTES IKKE`
- `(OBS)` alene som indikator for problematisk hotel
- `test`, `testto`, `testtre` (testrækker)
- `Dummy-hotel` (placeholder-rækker)

### Geocoding
Koordinater udledes fra adresse + postnummer via Nominatim API (OpenStreetMap, gratis).

---

## 6. Ruteoptimering

### Algoritme
To-trins tilgang:
1. **Nearest-neighbor** → hurtigt første bud på rækkefølge
2. **2-opt forbedring** → iterativ optimering der bytter par af stops

### Constraints (skal overholdes)
```
MAX_CONCERTS_PER_DAY = 3
MAX_SCHOOLS_PER_DAY = 2  (3 hvis aftenkoncert)
CONCERT_DURATION_MIN = 45
SETUP_TEARDOWN_MIN = 35   (standard – kan justeres)
FIRST_CONCERT_EARLIEST = "08:30"
LAST_CONCERT_START = "12:00"
WEEKDAYS_ONLY = true
```

### Afstandsberegning
Bruger OSRM (Open Source Routing Machine) til køreafstande og -tider:
- Endpoint: `https://router.project-osrm.org/route/v1/driving/`
- Alternativt: self-hosted OSRM for bedre performance

### Output
```typescript
type OptimizedTour = {
  days: TourDay[];
  totalKm: number;
  hotelNights: number;
}

type TourDay = {
  date: Date;
  schools: School[];
  kmThisDay: number;
  requiresHotel: boolean;
  suggestedHotel?: Hotel;
}
```

---

## 7. Hotel-matching

### Hvornår kræves hotel?
En aften kræver hotel hvis:
- Afstand fra sidste spillested til første spillested næste dag > 100 km
- **ELLER** første spillested næste dag er i et andet "Område" end dagens spillesteder

### Matchning-logik
1. Find dagens "Område" (fra spillested-kolonnen)
2. Find alle aktive hoteller i det samme Område
3. Beregn afstand fra dagens sidste spillested til hvert hotel
4. Foreslå det nærmeste hotel

### UI-adfærd
- Alle hoteller vises som slørede/dæmpede markører på kortet
- Foreslåede hoteller lyser op i gult/grønt
- Planlægger kan klikke et alternativt hotel → det vælges og km opdateres

---

## 8. Drag-and-drop justering

### Muligheder for justering
- Trække en skole op/ned inden for samme dag
- Trække en skole til en anden dag
- Klikke på hotel-markør på kortet for at skifte hotel

### Live-opdatering
Ved hver ændring genberegnes:
- Km for den berørte dag
- Total km for hele turnéen
- Om hotel stadig er nødvendigt den pågældende aften

### Validering
Vis advarsel (ikke bloker) hvis en ændring bryder en constraint:
- "⚠️ Dag onsdag har nu 3 skoler – kontrollér om det er muligt"
- "⚠️ Kørsel mellem Hirtshals og Brørup er 280 km – for lang en dagsetape?"

---

## 9. Database-struktur (Supabase)

```sql
-- Turnéer
tours (
  id uuid PRIMARY KEY,
  name text,           -- "Thomas Sandberg – ReCycle 25/26"
  band_name text,
  created_at timestamp,
  updated_at timestamp
)

-- Skoler/spillesteder på en given turné
concert_stops (
  id uuid PRIMARY KEY,
  tour_id uuid REFERENCES tours(id),
  school_name text,
  address text,
  postal_code text,
  city text,
  municipality text,
  area text,           -- "Område 2 - Kenneth"
  concert_date date,
  concert_time time,
  is_evening_concert boolean DEFAULT false,
  notes text,
  lat decimal,
  lng decimal,
  day_order integer,   -- Rækkefølge inden for dagen
  tour_order integer   -- Global rækkefølge i turnéen
)

-- Hoteller (importeret fra Excel-stamdata)
hotels (
  id uuid PRIMARY KEY,
  name text,
  address text,
  postal_code text,
  city text,
  municipality text,
  area text,           -- "Område 2 - Kenneth"
  has_agreement boolean,
  single_room_price integer,
  double_room_price integer,
  checkin_after time,
  checkout_before time,
  breakfast_included boolean,
  parking text,
  notes text,
  is_active boolean DEFAULT true,
  lat decimal,
  lng decimal
)

-- Valgte hoteller på en given turné
tour_hotels (
  id uuid PRIMARY KEY,
  tour_id uuid REFERENCES tours(id),
  hotel_id uuid REFERENCES hotels(id),
  night_date date,     -- Hvilken nat
  is_suggested boolean -- true = algoritmens forslag, false = manuelt valgt
)
```

---

## 10. GDPR og persondatabehandling

### Hvilke personoplysninger behandles

Appen berører to kategorier af personoplysninger — begge håndteres udelukkende i planlæggerens browser og forlader aldrig LMS's servere:

| Datakategori | Felter | Kilde | Formål |
|---|---|---|---|
| Musikers hjemsted | Fornavn, efternavn, gadenr, postnr, by | Musikerliste (Excel) | Beregne køreafstand hjem → første koncertsted |
| Spillestedets kontaktperson | Navn, mail, mobil (kol. N, O, P) | Turnéplan (Excel) | Bruges ikke af appen — læses aldrig |
| Besøgsskolens kontaktperson | Navn, mail (kol. V, W) | Turnéplan (Excel) | Bruges ikke af appen — læses aldrig |

Skole- og hoteldata (adresser og navne på institutioner) er ikke personoplysninger.

### Retsgrundlag

**Artikel 6(1)(f) — Legitim interesse.** LMS behandler musikerdata for at beregne km-godtgørelse og planlægge logistik. Musikerne er ansatte eller kontraktparter, og behandlingen er nødvendig for at administrere arbejdsforholdet. Se separat legitim interesse-vurdering (`GDPR_legitim_interesse.docx` i projektets rod).

Kontaktpersondata i turnéplan-Excel behandles aldrig af appen — kolonnerne ignoreres fuldstændigt under parsing.

### Privacy by design — implementerede foranstaltninger

**1. Al parsing af Excel-filer sker i browseren**
Både musikerlisten og turnéplan-Excel læses og parses direkte i planlæggerens browser med SheetJS. Ingen af filerne sendes til LMS's servere. Persondata forlader aldrig planlæggerens computer.

**2. Geocoding af musikeradresser sker direkte fra browseren**
Browseren kalder OpenStreetMap/Nominatim direkte uden om LMS's server. Kun adressen (ikke navn eller andre identifikatorer) sendes, og kun GPS-koordinaterne returneres og bruges videre.

**3. Ephemeral lagring**
Al data fra Excel-filer gemmes udelukkende i browserens `sessionStorage` — slettes automatisk når fanen lukkes. Ingen persondata skrives nogensinde til database.

**4. Dataminimering i Skoler2627.xlsx**
Skolefilen på serveren er strippet til tre kolonner: skole, kommune og projektuger. Alle øvrige kolonner — kontaktpersoner, telefonnumre, mails og adgangskoder — er fjernet permanent. Se `VEJLEDNING_SKOLEFIL.md` for vedligeholdelsesprocedure.

**5. Koordinater — ikke adresser — sendes til tredjeparter**
Efter geocoding er det kun GPS-koordinater der sendes til OSRM for vejafstandsberegning. Aldrig adresser eller navne.

### Dataflow — musikerdata trin for trin

```
1. Planlægger uploader musikerliste (Excel)
   → Filen læses og parses i browseren (SheetJS)
   → Ingen data sendes til LMS's server
   → Rådata gemmes i sessionStorage
   → Ingen DB-skrivning

2. Planlægger klikker Optimér
   → Browser filtrerer musikere der matcher turnéens band/produktion
   → Browser kalder Nominatim direkte — kun adresse, intet navn
   → Nominatim returnerer GPS-koordinater
   → Koordinater sendes til OSRM for vejafstandsberegning
   → Resultater vises i UI

3. Fanen lukkes → sessionStorage ryddes → ingen data bevaret
```

### Dataflow — turnéplan-Excel trin for trin

```
1. Planlægger uploader turnéplan (Excel)
   → Filen læses og parses i browseren (SheetJS)
   → Browser henter projektuger fra /api/project-weeks
     (returnerer kun skole + kommune + projektuger — ingen persondata)
   → Kontaktpersonkolonner (N, O, P, V, W) ignoreres fuldstændigt
   → Ingen data med personoplysninger sendes til LMS's server
   → Koncertdata gemmes i sessionStorage

2. Planlægger klikker Optimér
   → Skoleadresser geocodes via LMS-server (institutionsadresser, ikke persondata)
   → GPS-koordinater gemmes i sessionStorage

3. Fanen lukkes → sessionStorage ryddes → ingen data bevaret
```

### Hvad de enkelte tjenester modtager

| Tjeneste | Modtager | Modtager IKKE |
|---|---|---|
| LMS-server (Vercel) | Skoleadresser til geocoding, GPS-koordinater, hoteldata | Musikerdata, turnéplan-Excel, kontaktpersondata |
| OpenStreetMap/Nominatim | Musikers gadenr + postnr + by + landekode | Navn, bandnavn, identifikatorer |
| OSRM | GPS-koordinater | Adresser, navne |
| Supabase (database) | Skole- og hoteldata (institutionsdata) | Personoplysninger af nogen art |

### Bemærkning om User-Agent-header

Nominatims brugsvilkår kræver en identifikations-header ved alle forespørgsler:
`User-Agent: LMS-Turneplanner/1.0 (kenneth@lms.dk)`

Dette er app-administratorens kontaktmail — ikke musikerens. Den er identisk i alle forespørgsler og knytter sig til appen, ikke til den adresse der geocodes.

### Hvad skal udfyldes / vedligeholdes

- [ ] CVR-nummer og kontaktmail i `GDPR_legitim_interesse.docx` (projektets rod)
- [ ] Sletningsfrist: session-baseret — ingen frist nødvendig, da data aldrig persisteres
- [ ] Ved opdatering af Skoler2627.xlsx: følg `VEJLEDNING_SKOLEFIL.md` — kun 3 kolonner må være i filen
- [ ] Ved ansættelse af nye planlæggere: orienter om sessionStorage-modellen

---

## 12. Fremtidige funktioner (ikke MVP)

- PDF/print-eksport af færdig turnéplan
- Email-integration til direkte hotelbestilling
- Historik over tidligere turnéer
- Kilometerberegning for individuelle musikere (til kilometergodtgørelse)
- Multi-band-visning på samme kort

---

## 11. MVP-definition

Følgende skal virke før appen er klar til brug:

- [ ] Upload og parse Excel-fil korrekt
- [ ] Geocode alle adresser
- [ ] Vis skoler på kort med nummererede markører
- [ ] Kør optimeringsalgoritme
- [ ] Vis optimeret rute som stiplet linje
- [ ] Vis dragbar liste gruppered per dag
- [ ] Live km-beregning ved drag-and-drop
- [ ] Vis hoteller som slørede markører
- [ ] Foreslå hotel automatisk
- [ ] Klik på hotel for at skifte
