import { NextResponse } from "next/server";
import { parseHotelList } from "@/lib/hotels/parseHotelList";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type HotelRow = {
  id?: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  municipality: string;
  area: string;
  has_agreement: boolean;
  single_room_price: number | null;
  double_room_price: number | null;
  checkin_after: string | null;
  checkout_before: string | null;
  breakfast_included: boolean;
  parking: string | null;
  notes: string;
  is_active: boolean;
  lat: null;
  lng: null;
};

/**
 * POST /api/admin/import-hotels  (multipart: field "file")
 * Fase 1: parser Excel og gemmer hoteldata uden koordinater.
 * Slår op på navn for at afgøre insert vs. update — kræver ingen unique constraint.
 * Returnerer listen af hoteller der skal geocodes i fase 2 (klient-drevet loop).
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Ingen fil modtaget" }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseHotelList(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Kunne ikke læse Excel-fil";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { hotels, excluded } = parsed;

  const rows: HotelRow[] = hotels.map((h) => ({
    name: h.name,
    address: h.address,
    postal_code: h.postalCode,
    city: h.city,
    municipality: h.municipality,
    area: h.area,
    has_agreement: h.hasAgreement,
    single_room_price: h.singleRoomPrice != null ? Math.round(h.singleRoomPrice) : null,
    double_room_price: h.doubleRoomPrice != null ? Math.round(h.doubleRoomPrice) : null,
    checkin_after: h.checkinAfter,
    checkout_before: h.checkoutBefore,
    breakfast_included: h.breakfastIncluded,
    parking: h.parking,
    notes: h.notes,
    is_active: true,
    lat: null,
    lng: null,
  }));

  const supabase = createSupabaseServiceClient();

  // Slå eksisterende hoteller op på navn — undgår brug af ON CONFLICT
  const names = rows.map((r) => r.name);
  const { data: existing, error: lookupError } = await supabase
    .from("hotels")
    .select("id, name")
    .in("name", names);
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const idByName = new Map((existing ?? []).map((h) => [h.name as string, h.id as string]));

  // Deduplikér på navn (Excel kan have dubletter) — behold sidste forekomst
  const uniqueByName = new Map(rows.map((r) => [r.name, r]));
  const uniqueRows = [...uniqueByName.values()];

  const toInsert = uniqueRows.filter((r) => !idByName.has(r.name));
  const toUpdate = uniqueRows
    .filter((r) => idByName.has(r.name))
    .map((r) => ({ ...r, id: idByName.get(r.name)! }));

  const resultRows: { id: string; name: string; address: string; postal_code: string; city: string }[] = [];

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("hotels")
      .insert(toInsert)
      .select("id, name, address, postal_code, city");
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    resultRows.push(...(inserted ?? []));
  }

  if (toUpdate.length > 0) {
    // Upsert på primærnøgle (id) — den constraint eksisterer altid
    const { data: updated, error: updateError } = await supabase
      .from("hotels")
      .upsert(toUpdate, { onConflict: "id" })
      .select("id, name, address, postal_code, city");
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    resultRows.push(...(updated ?? []));
  }

  return NextResponse.json({
    imported: resultRows.length,
    excluded: excluded.length,
    needsGeocode: resultRows,
  });
}
