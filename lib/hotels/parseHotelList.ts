import * as XLSX from "xlsx";
import { HOTEL_EXCEL_COLUMNS, HOTEL_EXCLUDE_PATTERNS } from "@/types/excel";

/**
 * Rå hotel-række efter parsing — geocoding sker separat i import-scriptet.
 */
export type ParsedHotel = {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  municipality: string;
  area: string;
  hasAgreement: boolean;
  singleRoomPrice: number | null;
  doubleRoomPrice: number | null;
  checkinAfter: string | null;
  checkoutBefore: string | null;
  breakfastIncluded: boolean;
  parking: string | null;
  notes: string;
};

export type HotelParseResult = {
  hotels: ParsedHotel[];
  excluded: Array<{ name: string; reason: string }>;
};

/**
 * Parser hotel-Excel og filtrerer LUKKET/BENYTTES IKKE/test-rækker fra.
 */
export function parseHotelList(
  buffer: ArrayBuffer | Buffer,
): HotelParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Hotel-Excel har ingen ark.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: null },
  );

  const hotels: ParsedHotel[] = [];
  const excluded: HotelParseResult["excluded"] = [];

  for (const row of rows) {
    const name = readStr(row, HOTEL_EXCEL_COLUMNS.name);
    if (!name) continue;

    const reason = excludeReason(name);
    if (reason) {
      excluded.push({ name, reason });
      continue;
    }

    hotels.push({
      name,
      address: readStr(row, HOTEL_EXCEL_COLUMNS.address),
      postalCode: readStr(row, HOTEL_EXCEL_COLUMNS.postalCode),
      city: readStr(row, HOTEL_EXCEL_COLUMNS.city),
      municipality: readStr(row, HOTEL_EXCEL_COLUMNS.municipality),
      area: readStr(row, HOTEL_EXCEL_COLUMNS.area),
      hasAgreement: readYesNo(row, HOTEL_EXCEL_COLUMNS.agreement),
      singleRoomPrice: readNum(row, HOTEL_EXCEL_COLUMNS.singleRoomPrice),
      doubleRoomPrice: readNum(row, HOTEL_EXCEL_COLUMNS.doubleRoomPrice),
      checkinAfter: readTimeOrNull(row, HOTEL_EXCEL_COLUMNS.checkinAfter),
      checkoutBefore: readTimeOrNull(row, HOTEL_EXCEL_COLUMNS.checkoutBefore),
      breakfastIncluded: readYesNo(row, HOTEL_EXCEL_COLUMNS.breakfast),
      parking: readStr(row, HOTEL_EXCEL_COLUMNS.parking) || null,
      notes: readStr(row, HOTEL_EXCEL_COLUMNS.notes),
    });
  }

  return { hotels, excluded };
}

function excludeReason(name: string): string | null {
  const lower = name.toLowerCase();
  for (const pattern of HOTEL_EXCLUDE_PATTERNS) {
    if (lower.includes(pattern)) return `Matcher udelukkelses-mønster "${pattern}"`;
  }
  return null;
}

function readStr(row: Record<string, unknown>, col: string): string {
  const v = row[col];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function readYesNo(row: Record<string, unknown>, col: string): boolean {
  const v = readStr(row, col).toLowerCase();
  return v === "ja" || v === "yes" || v === "true" || v === "1";
}

function readNum(row: Record<string, unknown>, col: string): number | null {
  const v = row[col];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.,]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readTimeOrNull(
  row: Record<string, unknown>,
  col: string,
): string | null {
  const v = readStr(row, col);
  if (!v) return null;
  // Accept "15:00", "15.00", eller Excel decimal som allerede er konverteret
  const match = v.match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}
