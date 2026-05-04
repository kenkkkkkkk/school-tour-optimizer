/**
 * Domænetyper for koncerter, skoler og turnédage.
 * Matcher databaseskemaet 1:1 — felter der kun findes i DB (id'er osv.)
 * er markeret som optional indtil rækken er persisteret.
 */

export type GeoCoords = {
  lat: number;
  lng: number;
};

export type ConcertType = "SPI" | "EFT" | "LØS" | "KUP" | "PRØ" | "FES";

export const CONCERT_TYPE_LABELS: Record<ConcertType, string> = {
  SPI: "Spillestedskoncert",
  EFT: "Efterskolekoncert",
  LØS: "Løssalgskoncert",
  KUP: "Kulturpakker-koncert",
  PRØ: "Prøvekoncert",
  FES: "Festivalkoncert",
};

/**
 * En konkret spillested-stop på en turné.
 * Geocoding-felter kan være null hvis adressen ikke kunne findes —
 * UI viser en advarsel og planlæggeren kan rette manuelt (post-MVP).
 */
export type ConcertStop = {
  id?: string;
  tourId?: string;
  schoolName: string;
  address: string;
  postalCode: string;
  city: string;
  municipality: string;
  /** Område-streng direkte fra Excel, f.eks. "Område 2 - Kenneth" */
  area: string;
  /** Dato uden tid — konverteret fra Excel-decimal */
  concertDate: Date;
  /** Tid på dagen som "HH:mm" — adskilt fra dato for nem sammenligning */
  concertTime: string;
  isEveningConcert: boolean;
  notes: string;
  concertTypes: ConcertType[];
  /** Sand hvis spillestedet endnu ikke er fundet ("Område X"-placeholder) */
  isPlaceholder: boolean;
  /** Faste projektuger fra Skoler-filen, tom streng hvis ingen data */
  projectWeeks: string;
  lat: number | null;
  lng: number | null;
  /** Rækkefølge inden for dagen (0-indekseret) */
  dayOrder: number;
  /** Global rækkefølge i turnéen (0-indekseret) */
  tourOrder: number;
  /** Forhindrer drag-and-drop-flytning når true */
  locked?: boolean;
};

/**
 * En dag på turnéen med grupperede skoler og beregnet distance.
 * `requiresHotel` og `suggestedHotel` fyldes af hotel-matcheren.
 */
export type TourDay = {
  date: Date;
  schools: ConcertStop[];
  /** Km kørt på denne dag (fra start-punkt til sidste skole) */
  kmThisDay: number;
  requiresHotel: boolean;
  /** Hotel-ID hvis et forslag er fundet */
  suggestedHotelId: string | null;
  /** Hotel-ID valgt af planlæggeren (overskriver suggested) */
  selectedHotelId: string | null;
};

export type Tour = {
  id?: string;
  name: string;
  bandName: string;
  /** Valgfri udgangsadresse (musikernes bopæl) */
  homeBase?: GeoCoords;
  days: TourDay[];
  totalKm: number;
  hotelNights: number;
};

/**
 * Advarsler der returneres fra optimizer/validator — bryder ikke planen,
 * men vises i UI så planlæggeren kan tage stilling.
 */
export type PlanningWarning = {
  type:
    | "too_many_schools"
    | "late_start"
    | "long_drive"
    | "missing_geocode"
    | "unassigned_date";
  message: string;
  /** ISO-dato hvis advarslen knytter sig til en dag */
  date?: string;
  /** School-ID hvis advarslen knytter sig til en enkelt skole */
  schoolId?: string;
};
