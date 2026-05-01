/**
 * Rå Excel-række-shape før parsing.
 * Alle felter er `unknown` — parseTourPlan validerer og konverterer.
 *
 * Kolonnenavne matcher præcist LMS's turnéplan-Excel. Afvigelser skal
 * give en tydelig fejl frem for stille at ignoreres.
 */
export const TOUR_EXCEL_COLUMNS = {
  date: "Dato",
  musicianGroup: "Musikgruppe",
  schoolName: "Spillested",
  address: "Spillested - adresse",
  postalCode: "Spillested - postnummer",
  city: "Spillested - by",
  area: "Spillested - område",
  municipality: "Spillested - kommune",
  notes: "OBS",
} as const;

export type TourExcelColumn =
  (typeof TOUR_EXCEL_COLUMNS)[keyof typeof TOUR_EXCEL_COLUMNS];

export type RawTourRow = Record<string, unknown>;

/**
 * Kolonner i hotel-Excel (separat fil, engangs-import).
 */
export const HOTEL_EXCEL_COLUMNS = {
  name: "Hotel navn",
  address: "Adresse",
  postalCode: "Postnr",
  city: "By",
  municipality: "Kommune",
  area: "Område",
  agreement: "Aftale",
  singleRoomPrice: "Pris enkeltværelse",
  doubleRoomPrice: "Pris dobbeltværelse",
  checkinAfter: "Checkin efter",
  checkoutBefore: "Checkout før",
  breakfast: "Morgenmad",
  parking: "Parkering",
  notes: "Bemærkninger",
} as const;

/**
 * Navne-strenge der diskvalificerer et hotel fra import.
 * Case-insensitive substring match.
 */
/** Valgfri kolonne — ikke alle turnéplaner har den */
export const TOUR_PRODUCTION_COLUMN = "Produktion" as const;

export const HOTEL_EXCLUDE_PATTERNS = [
  "(lukket)",
  "lukket",
  "(benyttes ikke)",
  "benyttes ikke",
  "(obs)",
  "test",
  "testto",
  "testtre",
  "dummy-hotel",
] as const;
