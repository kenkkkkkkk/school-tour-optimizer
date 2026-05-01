import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseTourPlan } from "../parseTourPlan";
import { TOUR_EXCEL_COLUMNS } from "@/types/excel";
import { dateOnlyISO } from "../excelDate";

/**
 * Hjælper: byg en Excel-buffer in-memory fra en række af objekter.
 * Undgår at vi skal have en fysisk fixture-fil checked ind.
 */
function buildExcel(rows: Array<Record<string, unknown>>): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Turné");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf as ArrayBuffer;
}

const VALID_ROW = {
  [TOUR_EXCEL_COLUMNS.date]: 46027 + 9 / 24, // 2026-01-05 kl. 09:00
  [TOUR_EXCEL_COLUMNS.musicianGroup]: "Thomas Sandberg",
  [TOUR_EXCEL_COLUMNS.schoolName]: "Vestbjerg Skole",
  [TOUR_EXCEL_COLUMNS.address]: "Skolevej 1",
  [TOUR_EXCEL_COLUMNS.postalCode]: "9380",
  [TOUR_EXCEL_COLUMNS.city]: "Vestbjerg",
  [TOUR_EXCEL_COLUMNS.area]: "Område 1 - Nord - Mads",
  [TOUR_EXCEL_COLUMNS.municipality]: "Aalborg",
  [TOUR_EXCEL_COLUMNS.notes]: "Ingen særlige aftaler",
};

describe("parseTourPlan", () => {
  it("parser en gyldig række med alle felter", () => {
    const buf = buildExcel([VALID_ROW]);
    const result = parseTourPlan(buf);

    expect(result.stops).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.bandName).toBe("Thomas Sandberg");

    const stop = result.stops[0];
    expect(stop.schoolName).toBe("Vestbjerg Skole");
    expect(stop.address).toBe("Skolevej 1");
    expect(stop.postalCode).toBe("9380");
    expect(stop.city).toBe("Vestbjerg");
    expect(stop.area).toBe("Område 1 - Nord - Mads");
    expect(dateOnlyISO(stop.concertDate)).toBe("2026-01-05");
    expect(stop.concertTime).toBe("09:00");
    expect(stop.isEveningConcert).toBe(false);
    expect(stop.lat).toBeNull();
    expect(stop.lng).toBeNull();
    expect(stop.tourOrder).toBe(0);
  });

  it("markerer aftenkoncerter (kl. 17+) korrekt", () => {
    const eveningRow = {
      ...VALID_ROW,
      [TOUR_EXCEL_COLUMNS.date]: 46027 + 19 / 24, // kl. 19:00
      [TOUR_EXCEL_COLUMNS.schoolName]: "Bjerringbro Efterskole",
    };
    const buf = buildExcel([eveningRow]);
    const result = parseTourPlan(buf);

    expect(result.stops[0].isEveningConcert).toBe(true);
    expect(result.stops[0].concertTime).toBe("19:00");
  });

  it("kaster fejl når påkrævede kolonner mangler", () => {
    const brokenRow: Record<string, unknown> = { ...VALID_ROW };
    delete brokenRow[TOUR_EXCEL_COLUMNS.address];
    const buf = buildExcel([brokenRow]);

    expect(() => parseTourPlan(buf)).toThrow(/Spillested - adresse/);
  });

  it("springer rækker med ugyldig dato over og rapporterer dem", () => {
    const rows = [
      VALID_ROW,
      { ...VALID_ROW, [TOUR_EXCEL_COLUMNS.date]: "ikke-en-dato" },
    ];
    const buf = buildExcel(rows);
    const result = parseTourPlan(buf);

    expect(result.stops).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].rowIndex).toBe(3);
    expect(result.skipped[0].reason).toMatch(/dato/i);
  });

  it("ignorerer tomme rækker (manglende skolenavn) uden at logge", () => {
    const rows = [
      VALID_ROW,
      { ...VALID_ROW, [TOUR_EXCEL_COLUMNS.schoolName]: "" },
    ];
    const buf = buildExcel(rows);
    const result = parseTourPlan(buf);

    expect(result.stops).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it("tildeler sekventielle tour_order værdier", () => {
    const rows = [
      { ...VALID_ROW, [TOUR_EXCEL_COLUMNS.schoolName]: "A" },
      { ...VALID_ROW, [TOUR_EXCEL_COLUMNS.schoolName]: "B" },
      { ...VALID_ROW, [TOUR_EXCEL_COLUMNS.schoolName]: "C" },
    ];
    const buf = buildExcel(rows);
    const result = parseTourPlan(buf);

    expect(result.stops.map((s) => s.tourOrder)).toEqual([0, 1, 2]);
  });

  it("kaster fejl på tomt ark", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), "Tom");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    expect(() => parseTourPlan(buf as ArrayBuffer)).toThrow();
  });
});
