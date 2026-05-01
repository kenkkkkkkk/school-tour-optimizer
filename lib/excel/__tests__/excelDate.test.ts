import { describe, it, expect } from "vitest";
import {
  excelDateToJS,
  dateOnlyISO,
  timeOnlyHHMM,
} from "../excelDate";

describe("excelDateToJS", () => {
  it("konverterer heltal til midnat UTC", () => {
    // Excel 1 = 1900-01-01, men pga. skudår-bug'en er vores formel
    // kalibreret så 25569 = 1970-01-01 (JS epoch).
    const result = excelDateToJS(25569);
    expect(result.toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  it("konverterer decimal til tid-på-dagen", () => {
    // 25569.5 = 1970-01-01 kl. 12:00
    const result = excelDateToJS(25569.5);
    expect(result.toISOString()).toBe("1970-01-01T12:00:00.000Z");
  });

  it("håndterer en realistisk turné-dato", () => {
    // 46027 = 2026-01-05 (mandag). 25569 er 1970-01-01 per formlen.
    const result = excelDateToJS(46027);
    expect(dateOnlyISO(result)).toBe("2026-01-05");
  });

  it("bevarer tid 08:30 som decimal 0.3541666...", () => {
    // 0.3541666... = 08:30 på dagen (8.5/24)
    const result = excelDateToJS(46027 + 8.5 / 24);
    expect(timeOnlyHHMM(result)).toBe("08:30");
  });

  it("kaster fejl på ugyldig input", () => {
    expect(() => excelDateToJS(NaN)).toThrow();
    expect(() => excelDateToJS(-1)).toThrow();
    expect(() => excelDateToJS(0)).toThrow();
  });
});

describe("dateOnlyISO", () => {
  it("formatterer som YYYY-MM-DD", () => {
    const date = new Date("2026-04-22T15:30:00Z");
    expect(dateOnlyISO(date)).toBe("2026-04-22");
  });

  it("padder månder og dage med nul", () => {
    const date = new Date("2026-01-05T00:00:00Z");
    expect(dateOnlyISO(date)).toBe("2026-01-05");
  });
});

describe("timeOnlyHHMM", () => {
  it("formatterer som HH:mm", () => {
    const date = new Date("2026-04-22T08:30:00Z");
    expect(timeOnlyHHMM(date)).toBe("08:30");
  });

  it("padder med nul", () => {
    const date = new Date("2026-04-22T09:05:00Z");
    expect(timeOnlyHHMM(date)).toBe("09:05");
  });
});
