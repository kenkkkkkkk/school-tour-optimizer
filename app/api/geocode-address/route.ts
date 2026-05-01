import { NextResponse } from "next/server";
import { geocodeWithCache } from "@/lib/geocoding/geocodeWithCache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/geocode-address  body: { address, postalCode, city }
 * Returnerer koordinater for en enkelt adresse via geocode-cachen.
 * Persisterer ingen personoplysninger — geocode_cache gemmer kun adresse-hash → koordinater.
 */
export async function POST(request: Request) {
  try {
    const { address, postalCode, city } = await request.json() as {
      address?: string;
      postalCode?: string;
      city?: string;
    };

    if (!address || !postalCode || !city) {
      return NextResponse.json({ lat: null, lng: null });
    }

    // Fjern etage-angivelser (", 2. th", ", st. tv", ", H/f" osv.) — Nominatim forstår dem ikke
    const cleanedAddress = address.split(",")[0].trim();

    const supabase = createSupabaseServerClient();
    const geo = await geocodeWithCache(supabase, cleanedAddress, postalCode, city);
    return NextResponse.json({
      lat: geo.coords?.lat ?? null,
      lng: geo.coords?.lng ?? null,
    });
  } catch {
    return NextResponse.json({ lat: null, lng: null });
  }
}
