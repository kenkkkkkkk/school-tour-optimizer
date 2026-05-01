import { NextResponse } from "next/server";
import { z } from "zod";
import type { ConcertStop } from "@/types/concert";
import { geocodeWithCache } from "@/lib/geocoding/geocodeWithCache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const StopInput = z.object({
  schoolName: z.string(),
  address: z.string(),
  postalCode: z.string(),
  city: z.string(),
  municipality: z.string(),
  area: z.string(),
  concertDate: z.string(),
  concertTime: z.string(),
  isEveningConcert: z.boolean(),
  notes: z.string(),
  concertTypes: z.array(z.enum(["SPI", "EFT", "LØS", "KUP"])).default([]),
  isPlaceholder: z.boolean().default(false),
  projectWeeks: z.string().default(""),
  dayOrder: z.number(),
  tourOrder: z.number(),
});

const BodySchema = z.object({
  stops: z.array(StopInput),
});

/**
 * POST /api/geocode
 * Geocoder en liste af stops og returnerer dem med lat/lng udfyldt.
 * Bruger DB-cache — hurtig for allerede-kendte adresser.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const stops: ConcertStop[] = [];
    const failedStops: { schoolName: string; concertTime: string }[] = [];

    for (const s of parsed.data.stops) {
      if (s.isPlaceholder) {
        stops.push({ ...s, concertDate: new Date(s.concertDate), lat: null, lng: null });
        continue;
      }
      const geo = await geocodeWithCache(supabase, s.address, s.postalCode, s.city);
      stops.push({
        ...s,
        concertDate: new Date(s.concertDate),
        lat: geo.coords?.lat ?? null,
        lng: geo.coords?.lng ?? null,
      });
      if (!geo.coords) {
        failedStops.push({ schoolName: s.schoolName, concertTime: s.concertTime });
      }
    }

    return NextResponse.json({
      stops: stops.map((s) => ({ ...s, concertDate: s.concertDate.toISOString() })),
      failedStops,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
