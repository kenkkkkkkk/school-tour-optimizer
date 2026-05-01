import type { TourDay } from "@/types/concert";
import type { Hotel } from "@/types/hotel";
import { haversineMeters } from "@/lib/routing/distanceMatrix";
import { HOTEL_REQUIRED_THRESHOLD_M } from "@/lib/routing/constraints";

/**
 * Find det bedste hotel for en overnatning.
 *
 * Præferenceorden:
 *   1. Samme Område som dagens koncerter
 *   2. Har LMS-aftale
 *   3. Nærmeste afstand til dagens sidste spillested
 */
export function findBestHotel(
  day: TourDay,
  hotels: Hotel[],
): Hotel | null {
  const lastSchool = day.schools[day.schools.length - 1];
  if (!lastSchool?.lat || !lastSchool?.lng) return null;

  const lastCoord = { lat: lastSchool.lat, lng: lastSchool.lng };
  const dayArea = lastSchool.area;

  const active = hotels.filter((h) => h.isActive && h.lat !== null && h.lng !== null);
  if (active.length === 0) return null;

  // Separer hoteller i samme område vs. andre (fallback)
  const sameArea = active.filter((h) => h.area === dayArea);
  const pool = sameArea.length > 0 ? sameArea : active;

  // Sorter: aftale-hoteller først, derefter efter afstand
  // pool er allerede filtreret til kun at indeholde hoteller med koordinater
  const sorted = [...pool].sort((a, b) => {
    const aHasAgreement = a.hasAgreement ? 0 : 1;
    const bHasAgreement = b.hasAgreement ? 0 : 1;
    if (aHasAgreement !== bHasAgreement) return aHasAgreement - bHasAgreement;
    const distA = haversineMeters(lastCoord, { lat: a.lat!, lng: a.lng! });
    const distB = haversineMeters(lastCoord, { lat: b.lat!, lng: b.lng! });
    return distA - distB;
  });

  return sorted[0] ?? null;
}

/**
 * Tilknyt hotel-forslag til alle dage der kræver overnatning.
 * Muterer days-arrayet med suggestedHotelId.
 */
export function assignHotelSuggestions(
  days: TourDay[],
  hotels: Hotel[],
): void {
  for (const day of days) {
    if (!day.requiresHotel) continue;
    const best = findBestHotel(day, hotels);
    day.suggestedHotelId = best?.id ?? null;
  }
}

/**
 * Hvornår kræves overnatning?
 * Samme logik som optimizer — her eksponeret for direkte brug i tests.
 */
export function overnightRequired(
  day: TourDay,
  nextDay: TourDay,
): boolean {
  const lastToday = day.schools[day.schools.length - 1];
  const firstTomorrow = nextDay.schools[0];
  if (!lastToday?.lat || !lastToday?.lng || !firstTomorrow?.lat || !firstTomorrow?.lng) {
    return false;
  }
  const dist = haversineMeters(
    { lat: lastToday.lat, lng: lastToday.lng },
    { lat: firstTomorrow.lat, lng: firstTomorrow.lng },
  );
  return dist > HOTEL_REQUIRED_THRESHOLD_M || lastToday.area !== firstTomorrow.area;
}
