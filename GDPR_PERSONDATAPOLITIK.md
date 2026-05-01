# Persondatapolitik — LMS Turnéplanner

**Levende Musik i Skolen (LMS)**
**Sidst opdateret: April 2026**

Dette dokument forklarer i almindeligt sprog, hvad LMS Turnéplanner gør med
personoplysninger, hvorfor det er lovligt, og hvilke tekniske valg der er
truffet for at beskytte de involverede personer.

---

## Hvad er LMS Turnéplanner?

LMS Turnéplanner er et internt værktøj, som LMS's egne planlæggere bruger til
at lægge ruter for musikgrupper på skolekoncertturnéer i Danmark. Værktøjet
bruges af ca. 5–10 medarbejdere. Det er ikke tilgængeligt for offentligheden.

---

## Hvilke personoplysninger berører appen?

Appen arbejder med to Excel-filer, som indeholder personoplysninger:

### 1. Musikerlisten

Musikerlisten indeholder navne og hjemmeadresser på de musikere, der er
tilknyttet LMS's turnéer.

**Hvad bruges oplysningerne til?**
Appen bruger hjemmeadressen til at beregne, hvor langt den enkelte musiker
har at køre til dagens første koncert. Det bruges til at planlægge logistik
og danner grundlag for eventuel kilometergodtgørelse.

**Hvem er de registrerede?**
Musikere der er ansatte hos eller kontraktparter til LMS.

### 2. Turnéplanen

Turnéplanen indeholder navne, mailadresser og mobilnumre på kontaktpersoner
ved de skoler, der besøges. Det kan være en pædagogisk leder, en
kulturkontakt eller lignende.

**Hvad bruges oplysningerne til?**
Ingenting. Appen læser ikke disse kolonner. De er en del af den fil, som
eksporteres fra LMS's planlægningssystem, men turnéplanlæggeren har aldrig
behov for dem i selve ruteværktøjet, og de ignoreres fuldstændigt.

---

## Hvad er det juridiske grundlag?

Behandlingen af musikernes personoplysninger sker med hjemmel i:

**Databeskyttelsesforordningen (GDPR) artikel 6, stk. 1, litra f —
Legitim interesse.**

LMS har en legitim interesse i at beregne køreafstande for musikere i
forbindelse med planlægning af arbejde og udbetaling af godtgørelse. Musikerne
er ansatte eller kontraktparter, og behandlingen er en naturlig del af at
administrere arbejdsforholdet. Hensynet til musikernes privatliv vurderes ikke
at overstige denne interesse, da:

- Oplysningerne er begrænsede (navn og adresse)
- De behandles kortvarigt og aldrig gemmes permanent
- De ikke videregives til uvedkommende tredjeparter
- Formålet er direkte knyttet til arbejdsforholdet

En udvidet legitim interesse-vurdering er dokumenteret separat i filen
`GDPR_legitim_interesse.docx`.

Kontaktpersonernes oplysninger i turnéplanen behandles ikke. Da appen aldrig
læser eller anvender disse data, er der reelt ingen behandling, og GDPR's
regler om behandlingsgrundlag er ikke relevante for den del.

---

## Hvordan beskyttes personoplysningerne teknisk?

Her er det, der adskiller denne app fra mange andre løsninger — og som gør
den særligt godt egnet til at håndtere persondata:

### Oplysningerne forlader aldrig planlæggerens computer

Når en planlægger uploader musikerlisten eller turnéplanen, sker al behandling
direkte i browserens hukommelse på planlæggerens egen computer. Filerne sendes
ikke til LMS's server. Det betyder, at LMS's serverleverandør (Vercel) aldrig
ser eller registrerer musikernes navne eller adresser.

Det svarer til, at man åbner et regneark på sin egen computer og laver en
beregning lokalt — i stedet for at sende det til nogen for at få svaret.

### GPS-koordinater, ikke adresser, sendes videre

For at beregne køreafstande skal appen vide, hvor musikernes hjem ligger på
et kort. Det gøres ved at oversætte adressen til GPS-koordinater
(et par tal som f.eks. 56.1572°N, 10.2107°E). Denne oversættelse sker via
OpenStreetMaps kortservice, som kun modtager selve adressen — ikke musikerens
navn, ikke bandets navn, ikke noget der kan koble forespørgslen til en
bestemt person.

Når koordinaterne er beregnet, er det kun disse tal der sendes videre til
beregning af vejafstande. Adresser og navne bruges aldrig igen.

### Data slettes automatisk, når man lukker fanen

Alle oplysninger fra de uploadede filer gemmes midlertidigt i browserens
såkaldte session-lager — en kortvarig hukommelsesbuffer, der automatisk
tømmes, når man lukker browserfanen eller -vinduet. Der sker ingen
databaseskrivning. Ingen oplysninger bevares fra session til session.

Det betyder, at en planlægger, der er færdig med sit arbejde og lukker
browseren, ikke efterlader personoplysninger nogen steder i systemet.

### Skolefilen på serveren er renset for persondata

Appen bruger en fil med skoledata (`Skoler2627.xlsx`) til at slå projektuger
op for de skoler, der besøges. Denne fil ligger på LMS's server. Den
originale fil fra LMS's skoledatabase indeholdt kontaktpersoners navne,
telefonnumre og mailadresser. Disse oplysninger er fjernet, og filen
indeholder nu udelukkende:

- Skolens navn
- Kommune
- Faste projektuger

Der er ingen personoplysninger i den fil, der er tilgængelig for serveren.

---

## Hvem kan se oplysningerne?

| Hvem | Ser de personoplysninger? | Forklaring |
|---|---|---|
| Planlæggeren der uploader filen | Ja | De sidder ved computeren og bruger appen |
| LMS's server (Vercel) | Nej | Filerne sendes aldrig til serveren |
| OpenStreetMap | Kun adressen — ikke navn | Modtager kun adresseforespørgslen, anonymt |
| OSRM (vejafstande) | Nej | Modtager kun GPS-koordinater |
| Supabase (database) | Nej | Databasen gemmer kun skole- og hoteldata |
| Andre LMS-medarbejdere | Nej | Data er session-baseret og privat for den aktuelle bruger |

---

## Hvad med musikernes ret til indsigt og sletning?

Da oplysningerne aldrig gemmes permanent nogen steder, er der reelt ikke
noget at slette eller give indsigt i efter endt session. Oplysningerne
eksisterer kun, mens planlæggeren aktivt bruger appen.

Musikernes navne og adresser lever videre i den Excel-fil (musikerlisten),
som LMS opbevarer separat — håndteringen af den fil er ikke en del af
turnéplannerens ansvarsområde og reguleres af LMS's overordnede
persondatapolitik.

---

## Opsummering

| Spørgsmål | Svar |
|---|---|
| Gemmes musikernes data permanent? | Nej — slettes når fanen lukkes |
| Sendes navne til LMS's server? | Nej — al behandling sker i browseren |
| Deles data med tredjepart? | Kun anonyme adresser til OpenStreetMap |
| Er behandlingen lovlig? | Ja — legitim interesse (GDPR art. 6(1)(f)) |
| Bruges kontaktpersoners data fra turnéplanen? | Nej — ignoreres fuldstændigt |

---

*Spørgsmål til dette dokument kan rettes til kenneth@lms.dk.*
