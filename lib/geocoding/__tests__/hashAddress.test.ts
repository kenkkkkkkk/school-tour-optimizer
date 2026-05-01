import { describe, it, expect } from "vitest";
import { hashAddress } from "../geocodeWithCache";

describe("hashAddress", () => {
  it("giver samme hash uanset whitespace og case", () => {
    const a = hashAddress("Skolevej 1", "9380");
    const b = hashAddress("skolevej 1 ", "9380");
    const c = hashAddress("SKOLEVEJ  1", "9380");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("skelner mellem forskellige adresser", () => {
    const a = hashAddress("Skolevej 1", "9380");
    const b = hashAddress("Skolevej 2", "9380");
    expect(a).not.toBe(b);
  });

  it("skelner mellem forskellige postnumre", () => {
    const a = hashAddress("Skolevej 1", "9380");
    const b = hashAddress("Skolevej 1", "8000");
    expect(a).not.toBe(b);
  });

  it("normaliserer danske tegn (æøå)", () => {
    // Hvis nogen poster uden æøå (f.eks. "Aalborg" vs "Ålborg")
    // bør de mappe til samme hash når NFD + fjernelse af combining marks virker
    const a = hashAddress("Åvej 1", "9000");
    const b = hashAddress("Avej 1", "9000");
    // Efter NFD normalisering strippes det combining ring, så "Å" → "A"
    expect(a).toBe(b);
  });
});
