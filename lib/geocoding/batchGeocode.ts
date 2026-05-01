import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConcertStop } from "@/types/concert";
import { geocodeWithCache } from "./geocodeWithCache";

export type BatchProgress = {
  completed: number;
  total: number;
  failed: number;
};

/**
 * Geocode en liste af ConcertStops sekventielt (p-queue tager sig af rate-limit).
 * Muterer stops'ene med lat/lng. Returnerer liste af stops der ikke kunne
 * geocodes — planlæggeren skal rette dem manuelt (post-MVP).
 */
export async function batchGeocodeStops(
  supabase: SupabaseClient,
  stops: ConcertStop[],
  onProgress?: (progress: BatchProgress) => void,
): Promise<ConcertStop[]> {
  const failed: ConcertStop[] = [];
  let completed = 0;

  for (const stop of stops) {
    const result = await geocodeWithCache(
      supabase,
      stop.address,
      stop.postalCode,
      stop.city,
    );
    if (result.coords) {
      stop.lat = result.coords.lat;
      stop.lng = result.coords.lng;
    } else {
      failed.push(stop);
    }
    completed += 1;
    onProgress?.({ completed, total: stops.length, failed: failed.length });
  }

  return failed;
}
