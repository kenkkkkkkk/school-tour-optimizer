# Vejledning: Opdatering af skoledata

Appen bruger en Excel-fil med skoledata til at slå *faste projektuger* op for
hvert spillested, når en turnéplan indlæses. Denne vejledning beskriver,
hvornår og hvordan filen opdateres.

---

## Hvad filen bruges til

Appen læser kun tre ting fra filen:

| Kolonne | Indhold | Bruges til |
|---|---|---|
| A | Skolens navn | Nøgle til opslag |
| B | Kommune | Nøgle til opslag (disambiguering ved ens navne) |
| C | Faste projektuger | Vises i turnélisten ved siden af skolens navn |

Alle andre oplysninger ignoreres af appen og må **ikke** være i filen
(se afsnittet om GDPR nedenfor).

---

## Hvornår skal filen opdateres?

Opdater filen når:
- Der starter et nyt skoleår og projektugerne ændrer sig
- Nye skoler kommer til eller falder fra
- En skoles navn eller kommune ændres i jeres system

---

## Arbejdsgang trin for trin

### Trin 1 — Eksportér fra jeres skoledatabase

Eksportér skoledata fra det system, I normalt bruger (f.eks. A-jour eller
tilsvarende). Eksporten vil typisk indeholde mange kolonner.

### Trin 2 — Behold kun de tre nødvendige kolonner

Åbn filen i Excel og slet **alle kolonner** undtagen:
- Skolens navn
- Kommune
- Faste projektuger

Rækkefølgen skal være præcis denne — navn i kolonne A, kommune i B,
projektuger i C. Rækken øverst skal indeholde kolonneoverskrifter
(hvad de hedder er ligegyldigt — det er positionen der tæller).

> **VIGTIGT — GDPR:** Den originale eksport indeholder sandsynligvis
> kontaktpersoners navne, telefonnumre, mailadresser og muligvis kodeord.
> Disse oplysninger **må ikke** være i den fil, der lægges i projektmappen.
> Slet dem i Excel, inden du gemmer og afleverer filen.

### Trin 3 — Gem filen med det rigtige navn

Filen **skal** hedde nøjagtigt:

```
Skoler2627.xlsx
```

Bemærk: navnet afspejler skoleåret 2026/27. Se nedenfor hvad du gør
ved nyt skoleår.

### Trin 4 — Placer filen i projektmappen

Læg filen i roden af projektmappen — samme mappe som denne vejledning
og filerne `SPEC.md`, `CLAUDE.md` osv.

Erstat den eksisterende fil. Der er ingen grund til at gemme den gamle version
i mappen (git-historikken bevarer ændringer automatisk hvis projektet
kører med versionsstyring).

### Trin 5 — Genstart appen

Appen indlæser skolefilen én gang og cacher den i hukommelsen. Efter du
har erstattet filen, skal udviklingsserveren genstartes:

```bash
npm run dev
```

Eller på Vercel: deploy appen på ny (Vercel samler filen ind som en del
af deploymentet).

---

## Nyt skoleår — hvad ændres

Når skoleåret skifter fra 26/27 til 27/28, skal **to** ting opdateres:

**1. Omdøb filen** til det nye skoleår:
```
Skoler2728.xlsx
```

**2. Opdatér filnavnet i koden** — åbn filen:
```
lib/excel/schoolLookup.ts
```

Find linjen (ca. linje 21):
```typescript
const filePath = path.join(process.cwd(), "Skoler2627.xlsx");
```

Ret `Skoler2627.xlsx` til det nye filnavn, f.eks. `Skoler2728.xlsx`.

Kør herefter `npm run type-check` for at bekræfte at alt er i orden.

---

## Tjekliste

- [ ] Kun tre kolonner i filen: navn, kommune, projektuger
- [ ] Ingen personoplysninger (navne, telefoner, mails, kodeord)
- [ ] Filen hedder `Skoler2627.xlsx` (eller det aktuelle skoleårs navn)
- [ ] Filen ligger i projektets rodmappe
- [ ] Appen er genstartet efter opdateringen
