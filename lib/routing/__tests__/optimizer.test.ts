import { describe, it, expect } from "vitest";
import { optimizeTour } from "../optimizer";
import type { ConcertStop } from "@/types/concert";
import type { DistanceMatrix } from "../distanceMatrix";

/**
 * Bygger en test-ConcertStop med fornuftige defaults.
 * Koordinater placeres omkring Danmark — de præcise tal er ikke vigtige
 * så længe matrix'en giver konsistente afstande.
 */
function makeStop(overrides: Partial<ConcertStop>): ConcertStop {
  return {
    schoolName: overrides.schoolName ?? "Test Skole",
    address: "Vej 1",
    postalCode: "9000",
    city: "Aalborg",
    municipality: "Aalborg",
    area: overrides.area ?? "Område 1 - Nord - Mads",
    concertDate: overrides.concertDate ?? new Date("2026-01-05"),
    concertTime: overrides.concertTime ?? "09:00",
    isEveningConcert: overrides.isEveningConcert ?? false,
    notes: "",
    concertTypes: [],
    isPlaceholder: false,
    projectWeeks: "",
    lat: overrides.lat ?? 57.0,
    lng: overrides.lng ?? 10.0,
    dayOrder: 0,
    tourOrder: overrides.tourOrder ?? 0,
    ...overrides,
  };
}

/**
 * Bygger en symmetrisk distance-matrix ud fra et array af par-afstande.
 * Indeks svarer til rækkefølgen i stops-arrayet.
 */
function buildMatrix(distances: number[][]): DistanceMatrix {
  return {
    distances,
    durations: distances.map((row) => row.map((d) => d * 60)), // fake
  };
}

describe("optimizeTour", () => {
  it("grupperer stops efter concert_date og tildeler dayOrder", () => {
    const monday = new Date("2026-01-05");
    const tuesday = new Date("2026-01-06");
    const stops = [
      makeStop({ schoolName: "A", concertDate: monday, tourOrder: 0 }),
      makeStop({ schoolName: "B", concertDate: monday, tourOrder: 1 }),
      makeStop({ schoolName: "C", concertDate: tuesday, tourOrder: 2 }),
    ];
    const matrix = buildMatrix([
      [0, 10, 100],
      [10, 0, 90],
      [100, 90, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    expect(result.days).toHaveLength(2);
    expect(result.days[0].schools).toHaveLength(2);
    expect(result.days[1].schools).toHaveLength(1);
    expect(result.days[0].schools.map((s) => s.schoolName)).toContain("A");
    expect(result.days[0].schools.map((s) => s.schoolName)).toContain("B");
    expect(result.days[1].schools[0].schoolName).toBe("C");
  });

  it("HARD CONSTRAINT: ubesatte hverdage får ALDRIG tildelt koncerter", () => {
    // Turné: mandag + onsdag (hopper over tirsdag)
    // Algoritmen må IKKE flytte noget til tirsdag selvom det ville give færre km
    const monday = new Date("2026-01-05");
    const wednesday = new Date("2026-01-07");
    const stops = [
      makeStop({ schoolName: "MonA", concertDate: monday, tourOrder: 0 }),
      makeStop({ schoolName: "MonB", concertDate: monday, tourOrder: 1 }),
      makeStop({ schoolName: "WedA", concertDate: wednesday, tourOrder: 2 }),
      makeStop({ schoolName: "WedB", concertDate: wednesday, tourOrder: 3 }),
    ];
    const matrix = buildMatrix([
      [0, 5, 200, 210],
      [5, 0, 205, 215],
      [200, 205, 0, 8],
      [210, 215, 8, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    // Præcis to dage — ingen tirsdag tilføjet
    expect(result.days).toHaveLength(2);
    const dates = result.days.map((d) => d.date.toISOString().slice(0, 10));
    expect(dates).toEqual(["2026-01-05", "2026-01-07"]);
    // Tirsdag (2026-01-06) må ikke optræde nogetsteds
    expect(dates).not.toContain("2026-01-06");
  });

  it("bevarer dato selv hvis en enkelt dag står alene uden for klynge", () => {
    // Edge case: en enkelt mandag + to uger uden koncerter + en mandag mere
    const firstMon = new Date("2026-01-05");
    const laterMon = new Date("2026-01-19");
    const stops = [
      makeStop({ schoolName: "Week1", concertDate: firstMon, tourOrder: 0 }),
      makeStop({ schoolName: "Week3", concertDate: laterMon, tourOrder: 1 }),
    ];
    const matrix = buildMatrix([
      [0, 50],
      [50, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    expect(result.days.map((d) => d.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-01-19",
    ]);
  });

  it("tildeler sekventielle dayOrder inden for hver dag", () => {
    const stops = [
      makeStop({ schoolName: "A", lat: 55.0, lng: 10.0, tourOrder: 0 }),
      makeStop({ schoolName: "B", lat: 55.1, lng: 10.1, tourOrder: 1 }),
      makeStop({ schoolName: "C", lat: 55.2, lng: 10.2, tourOrder: 2 }),
    ];
    const matrix = buildMatrix([
      [0, 10, 25],
      [10, 0, 12],
      [25, 12, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    const orders = result.days[0].schools.map((s) => s.dayOrder);
    expect(orders).toEqual([0, 1, 2]);
  });

  it("flager stops uden geocoding og placerer dem sidst i dagen", () => {
    const stops = [
      makeStop({ schoolName: "OK", lat: 55.0, lng: 10.0, tourOrder: 0 }),
      makeStop({ schoolName: "UGYLDIG", lat: null, lng: null, tourOrder: 1 }),
    ];
    const matrix = buildMatrix([
      [0, 10],
      [10, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    expect(result.warnings.some((w) => w.type === "missing_geocode")).toBe(true);
    const schoolNames = result.days.flatMap((d) => d.schools).map((s) => s.schoolName);
    expect(schoolNames).toContain("OK");
    expect(schoolNames).toContain("UGYLDIG");
    // Geocodede stops kommer før ikke-geocodede inden for dagen
    const day = result.days[0];
    expect(day.schools[0].schoolName).toBe("OK");
    expect(day.schools[1].schoolName).toBe("UGYLDIG");
  });

  it("advarer når en dag har >2 skoler uden aftenkoncert", () => {
    const date = new Date("2026-01-05");
    const stops = [
      makeStop({ schoolName: "A", concertDate: date, tourOrder: 0 }),
      makeStop({ schoolName: "B", concertDate: date, tourOrder: 1 }),
      makeStop({ schoolName: "C", concertDate: date, tourOrder: 2 }),
    ];
    const matrix = buildMatrix([
      [0, 10, 20],
      [10, 0, 15],
      [20, 15, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    expect(result.warnings.some((w) => w.type === "too_many_schools")).toBe(true);
  });

  it("accepterer 3 skoler hvis én er aftenkoncert", () => {
    const date = new Date("2026-01-05");
    const stops = [
      makeStop({ schoolName: "A", concertDate: date, tourOrder: 0 }),
      makeStop({ schoolName: "B", concertDate: date, tourOrder: 1 }),
      makeStop({
        schoolName: "Efterskole",
        concertDate: date,
        isEveningConcert: true,
        concertTime: "19:00",
        tourOrder: 2,
      }),
    ];
    const matrix = buildMatrix([
      [0, 10, 20],
      [10, 0, 15],
      [20, 15, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    expect(result.warnings.some((w) => w.type === "too_many_schools")).toBe(false);
  });

  it("sætter IKKE requiresHotel automatisk — det styres manuelt af planlæggeren", () => {
    // Selv fjerntliggende dage (Aalborg → Esbjerg, >100 km) sættes ikke automatisk
    const stops = [
      makeStop({
        schoolName: "Aalborg",
        concertDate: new Date("2026-01-05"),
        lat: 57.05,
        lng: 9.92,
        tourOrder: 0,
      }),
      makeStop({
        schoolName: "Esbjerg",
        concertDate: new Date("2026-01-06"),
        lat: 55.47,
        lng: 8.45,
        tourOrder: 1,
      }),
    ];
    const matrix = buildMatrix([
      [0, 300_000],
      [300_000, 0],
    ]);

    const result = optimizeTour({ stops, matrix });

    expect(result.days[0].requiresHotel).toBe(false);
  });
});
