/**
 * Hotel-stamdata importeret fra samarbejds-Excel.
 * Geocoding-felter er obligatoriske — hoteller uden koordinater
 * ekskluderes under import (`lib/hotels/matcher.ts` stoler på det).
 */
export type Hotel = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  municipality: string;
  /** Område-streng der matches mod ConcertStop.area */
  area: string;
  hasAgreement: boolean;
  singleRoomPrice: number | null;
  doubleRoomPrice: number | null;
  /** "HH:mm" */
  checkinAfter: string | null;
  /** "HH:mm" */
  checkoutBefore: string | null;
  breakfastIncluded: boolean;
  parking: string | null;
  notes: string;
  isActive: boolean;
  lat: number | null;
  lng: number | null;
};

/**
 * Valgt hotel på en konkret nat i en turné.
 */
export type TourHotel = {
  id: string;
  tourId: string;
  hotelId: string;
  /** Natten mellem denne dato og næste dag */
  nightDate: Date;
  /** true = optimizerens forslag, false = manuelt overskrevet af planlægger */
  isSuggested: boolean;
};
