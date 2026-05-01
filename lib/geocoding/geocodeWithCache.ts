import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeoCoords } from "@/types/concert";
import { geocodeAddress } from "./nominatim";

export type GeocodeSource = "cache" | "nominatim" | "failed";

export type CachedGeocode = {
  coords: GeoCoords | null;
  source: GeocodeSource;
};

/**
 * Beregn cache-nøgle fra normaliseret adresse + postnr.
 * Normalisering fjerner whitespace, lowercaser og fjerner diakritiske tegn
 * så f.eks. "Skolevej 1 " og "skolevej 1" giver samme hash.
 */
export function hashAddress(address: string, postalCode: string): string {
  const normalized = `${address} ${postalCode}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha1").update(normalized).digest("hex");
}

/**
 * Geocode en adresse med DB-cache foran Nominatim.
 *
 * Returnerer altid et resultat — ved permanente fejl gemmes en 'failed'
 * cache-række så vi ikke spilder rate-limit på samme adresse to gange.
 */
export async function geocodeWithCache(
  supabase: SupabaseClient,
  address: string,
  postalCode: string,
  city: string,
): Promise<CachedGeocode> {
  const addressHash = hashAddress(address, postalCode);

  const { data: cached } = await supabase
    .from("geocode_cache")
    .select("lat,lng,source")
    .eq("address_hash", addressHash)
    .maybeSingle();

  if (cached) {
    if (cached.source === "failed") {
      return { coords: null, source: "failed" };
    }
    if (cached.lat !== null && cached.lng !== null) {
      return {
        coords: { lat: Number(cached.lat), lng: Number(cached.lng) },
        source: "cache",
      };
    }
  }

  // Cache-miss — spørg Nominatim
  let coords: GeoCoords | null = null;
  try {
    coords = await geocodeAddress(address, postalCode, city);
  } catch (err) {
    console.error(`Nominatim-fejl for ${address}, ${postalCode}:`, err);
  }

  if (coords) {
    await supabase.from("geocode_cache").upsert({
      address_hash: addressHash,
      lat: coords.lat,
      lng: coords.lng,
      source: "nominatim",
    });
    return { coords, source: "nominatim" };
  }

  await supabase.from("geocode_cache").upsert({
    address_hash: addressHash,
    lat: null,
    lng: null,
    source: "failed",
  });
  return { coords: null, source: "failed" };
}
