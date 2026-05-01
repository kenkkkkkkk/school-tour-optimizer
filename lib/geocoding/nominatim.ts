import PQueue from "p-queue";
import type { GeoCoords } from "@/types/concert";

/**
 * Nominatim (OpenStreetMap) geocoding-klient.
 *
 * Fair-use policy kræver:
 * - Max 1 request/sek
 * - User-Agent header der identificerer applikationen
 * - Ingen bulk-geocoding af mere end få tusind adresser
 *
 * Vi kører med 1100 ms interval for at have lidt buffer mod serverens ur.
 */
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

const queue = new PQueue({
  concurrency: 1,
  interval: 1100,
  intervalCap: 1,
});

export type NominatimResult = GeoCoords | null;

/**
 * Geokode en dansk adresse. Returnerer null hvis Nominatim ikke kan finde den.
 *
 * @param address Gadenavn + husnummer, f.eks. "Skolevej 1"
 * @param postalCode Postnummer, f.eks. "9380"
 * @param city By (bruges til disambiguation), f.eks. "Vestbjerg"
 */
export async function geocodeAddress(
  address: string,
  postalCode: string,
  city: string,
): Promise<NominatimResult> {
  const userAgent =
    process.env.NOMINATIM_USER_AGENT ??
    "LMS-Turneplanner/1.0 (kenneth@lms.dk)";

  const query = `${address}, ${postalCode} ${city}, Denmark`;
  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "dk");

  const result = await queue.add(async () => {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "da",
      },
    });
    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`);
    }
    return (await res.json()) as Array<{ lat: string; lon: string }>;
  });

  if (!result || result.length === 0) return null;
  const first = result[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
