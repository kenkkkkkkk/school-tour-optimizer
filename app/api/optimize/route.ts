import { NextResponse } from "next/server";
import { z } from "zod";
import type { ConcertStop } from "@/types/concert";
import type { Hotel } from "@/types/hotel";
import { computeDistanceMatrix } from "@/lib/routing/distanceMatrix";
import { optimizeTour } from "@/lib/routing/optimizer";
import { assignHotelSuggestions } from "@/lib/hotels/matcher";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const StopSchema = z.object({
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
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  dayOrder: z.number(),
  tourOrder: z.number(),
});

const BodySchema = z.object({
  stops: z.array(StopSchema),
  homeBaseLat: z.number().optional(),
  homeBaseLng: z.number().optional(),
});

/**
 * POST /api/optimize
 * Input: ConcertStop[] (allerede geocodede)
 * Output: OptimizeResult + distanceMatrix
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const stops: ConcertStop[] = parsed.data.stops.map((s) => ({
      ...s,
      concertDate: new Date(s.concertDate),
    }));

    const geocoded = stops.filter((s) => s.lat !== null && s.lng !== null);
    if (geocoded.length < 2) {
      return NextResponse.json(
        { error: "Mindst 2 geocodede stops kræves for optimering." },
        { status: 400 },
      );
    }

    const points = geocoded.map((s) => ({ lat: s.lat!, lng: s.lng! }));
    const matrix = await computeDistanceMatrix(points);

    const indexMap = new Map<string, number>();
    geocoded.forEach((s, i) => {
      if (s.id) indexMap.set(s.id, i);
    });

    const homeBase =
      parsed.data.homeBaseLat && parsed.data.homeBaseLng
        ? { lat: parsed.data.homeBaseLat, lng: parsed.data.homeBaseLng }
        : undefined;

    const result = optimizeTour({ stops, matrix, homeBase });

    // Hent hoteller fra DB og tilknyt forslag
    const supabase = createSupabaseServiceClient();
    const { data: hotelsRaw } = await supabase
      .from("hotels")
      .select("*")
      .eq("is_active", true);
    const hotels: Hotel[] = (hotelsRaw ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      postalCode: r.postal_code,
      city: r.city,
      municipality: r.municipality,
      area: r.area,
      hasAgreement: r.has_agreement,
      singleRoomPrice: r.single_room_price,
      doubleRoomPrice: r.double_room_price,
      checkinAfter: r.checkin_after,
      checkoutBefore: r.checkout_before,
      breakfastIncluded: r.breakfast_included,
      parking: r.parking,
      notes: r.notes ?? "",
      isActive: r.is_active,
      lat: r.lat,
      lng: r.lng,
    }));
    assignHotelSuggestions(result.days, hotels);

    return NextResponse.json({
      days: result.days.map((d) => ({
        ...d,
        date: d.date.toISOString(),
        schools: d.schools.map((s) => ({
          ...s,
          concertDate: s.concertDate.toISOString(),
        })),
      })),
      totalKm: result.totalKm,
      warnings: result.warnings,
      hotels,
      matrix: {
        distances: matrix.distances,
        durations: matrix.durations,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
