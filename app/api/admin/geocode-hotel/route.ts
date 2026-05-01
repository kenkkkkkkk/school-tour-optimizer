import { NextResponse } from "next/server";
import { geocodeWithCache } from "@/lib/geocoding/geocodeWithCache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/geocode-hotel
 * Body: { id: string, address: string, postalCode: string, city: string }
 * Geocoder ét hotel og gemmer koordinater i DB.
 */
export async function POST(request: Request) {
  const body = await request.json() as {
    id: string;
    address: string;
    postalCode: string;
    city: string;
  };

  const { id, address, postalCode, city } = body;
  if (!id || !address) {
    return NextResponse.json({ error: "Mangler id eller adresse" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const geo = await geocodeWithCache(supabase, address, postalCode, city);

  if (geo.coords) {
    await supabase
      .from("hotels")
      .update({ lat: geo.coords.lat, lng: geo.coords.lng })
      .eq("id", id);
  }

  return NextResponse.json({ id, ok: !!geo.coords });
}
