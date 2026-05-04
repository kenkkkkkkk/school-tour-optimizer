import * as XLSX from "xlsx";
import type { ConcertStop, ConcertType } from "@/types/concert";

const SPECIAL_TYPES: ConcertType[] = ["SPI", "EFT", "LØS", "KUP", "PRØ", "FES"];
const PLACEHOLDER_PATTERN = /^Område \d{1,2}$/i;

function parseConcertTypes(row: RawTourRow): ConcertType[] {
  const raw = row["Type"];
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim().toUpperCase() as ConcertType)
    .filter((t) => SPECIAL_TYPES.includes(t));
}
import { TOUR_EXCEL_COLUMNS, type RawTourRow } from "@/types/excel";
import { excelDateToJS, timeOnlyHHMM } from "./excelDate";

/**
 * Resultat af Excel-parsing. Rapporterer både succes-stops og eventuelle
 * rækker der blev sprunget over (f.eks. tomme datoer eller besøgsskoler).
 */
export type ParseResult = {
  stops: ConcertStop[];
  skipped: Array<{ rowIndex: number; reason: string }>;
  bandName: string;
  productionName: string;
};

/**
 * Parser en LMS turné-Excel til domæne-objekter.
 *
 * Strict validation:
 * - Hvis nogen af de påkrævede kolonner mangler → kaster fejl
 * - Hvis en række har uparsebar dato → springes over med log
 * - Tomme rækker (ingen skolenavn) → springes over uden log
 *
 * @param buffer Excel-filens indhold som ArrayBuffer eller Buffer
 */
export function parseTourPlan(buffer: ArrayBuffer | Buffer, projectWeeksMap: Map<string, string> = new Map()): ParseResult {
  let rows: RawTourRow[];

  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Excel-filen indeholder ingen ark.");
    }
    const sheet = workbook.Sheets[firstSheetName];
    rows = XLSX.utils.sheet_to_json<RawTourRow>(sheet, {
      defval: null,
      raw: true,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("ingen ark")) throw err;
    throw new Error(
      `Kunne ikke læse Excel-filen. Tjek at filen ikke er korrupt, ` +
      `ikke har flettede celler i headeren, og er gemt som .xlsx-format. ` +
      `(${err instanceof Error ? err.message : String(err)})`,
    );
  }

  if (rows.length === 0) {
    throw new Error("Excel-arket er tomt.");
  }

  validateColumns(rows[0]);

  const stops: ConcertStop[] = [];
  const skipped: ParseResult["skipped"] = [];
  let bandName = "";
  let productionName = "";

  rows.forEach((row, idx) => {
    const schoolName = readString(row, TOUR_EXCEL_COLUMNS.schoolName);
    if (!schoolName) {
      // Tom række — ignorér uden log
      return;
    }

    const dateRaw = row[TOUR_EXCEL_COLUMNS.date];
    if (typeof dateRaw !== "number" || !Number.isFinite(dateRaw)) {
      skipped.push({
        rowIndex: idx + 2, // +2 fordi Excel er 1-indekseret og har header
        reason: `Ugyldig eller manglende dato (${String(dateRaw)})`,
      });
      return;
    }

    const fullDate = excelDateToJS(dateRaw);
    const concertTime = timeOnlyHHMM(fullDate);
    const concertDate = new Date(
      Date.UTC(
        fullDate.getUTCFullYear(),
        fullDate.getUTCMonth(),
        fullDate.getUTCDate(),
      ),
    );

    const band = readString(row, TOUR_EXCEL_COLUMNS.musicianGroup);
    if (band && !bandName) {
      bandName = band;
    }

    const prod = readString(row, "Produktion");
    if (prod && !productionName) {
      productionName = prod;
    }

    const concertTypes = parseConcertTypes(row);
    const stop: ConcertStop = {
      schoolName,
      address: readString(row, TOUR_EXCEL_COLUMNS.address),
      postalCode: readString(row, TOUR_EXCEL_COLUMNS.postalCode),
      city: readString(row, TOUR_EXCEL_COLUMNS.city),
      municipality: readString(row, TOUR_EXCEL_COLUMNS.municipality),
      area: readString(row, TOUR_EXCEL_COLUMNS.area),
      concertDate,
      concertTime,
      isEveningConcert: isEveningTime(concertTime),
      notes: readString(row, TOUR_EXCEL_COLUMNS.notes),
      concertTypes,
      locked: concertTypes.length > 0,
      isPlaceholder: PLACEHOLDER_PATTERN.test(schoolName),
      projectWeeks: projectWeeksMap.get(`${schoolName.toLowerCase().trim()}|${readString(row, TOUR_EXCEL_COLUMNS.municipality).toLowerCase().trim()}`) ?? "",
      lat: null,
      lng: null,
      dayOrder: 0,
      tourOrder: stops.length,
    };
    stops.push(stop);
  });

  return { stops, skipped, bandName, productionName };
}

/**
 * Tjek at alle påkrævede kolonner findes i første række.
 * Fejler tydeligt ved manglende kolonner frem for at gætte.
 */
function validateColumns(firstRow: RawTourRow): void {
  const missing: string[] = [];
  for (const col of Object.values(TOUR_EXCEL_COLUMNS)) {
    if (!(col in firstRow)) {
      missing.push(col);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Kolonner mangler i Excel: ${missing.join(", ")}. ` +
        `Tjek at filen har de forventede kolonnenavne.`,
    );
  }
}

function readString(row: RawTourRow, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/**
 * Aftenkoncerter starter kl. 17:00 eller senere (heuristisk grænse).
 * Efterskoler kan have kl. 19-20 koncerter for eleverne der bor på stedet.
 */
function isEveningTime(hhmm: string): boolean {
  const [hStr] = hhmm.split(":");
  const h = Number(hStr);
  return Number.isFinite(h) && h >= 17;
}
