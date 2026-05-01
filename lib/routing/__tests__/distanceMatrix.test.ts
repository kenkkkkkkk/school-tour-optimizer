import { describe, it, expect } from "vitest";
import { haversineMeters, totalDistance } from "../distanceMatrix";

describe("haversineMeters", () => {
  it("giver 0 for samme punkt", () => {
    const p = { lat: 55.6761, lng: 12.5683 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it("beregner afstand mellem København og Aarhus (~158 km fugleflugt)", () => {
    const kbh = { lat: 55.6761, lng: 12.5683 };
    const aar = { lat: 56.1629, lng: 10.2039 };
    const meters = haversineMeters(kbh, aar);
    // Fugleflugt København↔Aarhus er ~158 km — accepter ±5 km
    expect(meters).toBeGreaterThan(153_000);
    expect(meters).toBeLessThan(163_000);
  });

  it("er symmetrisk", () => {
    const a = { lat: 55.0, lng: 10.0 };
    const b = { lat: 56.0, lng: 11.0 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe("totalDistance", () => {
  it("summerer langs sekventiel rækkefølge", () => {
    const matrix = {
      distances: [
        [0, 10, 20, 30],
        [10, 0, 15, 25],
        [20, 15, 0, 12],
        [30, 25, 12, 0],
      ],
    };
    // 0→1→2→3 = 10 + 15 + 12 = 37
    expect(totalDistance([0, 1, 2, 3], matrix)).toBe(37);
    // 0→3 = 30
    expect(totalDistance([0, 3], matrix)).toBe(30);
  });

  it("returnerer 0 for en enkelt-punkt rute", () => {
    const matrix = { distances: [[0]] };
    expect(totalDistance([0], matrix)).toBe(0);
  });
});
