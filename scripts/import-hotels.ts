/* eslint-disable no-console */
/**
 * Engangs-import af hotelliste fra Excel til Supabase.
 *
 * Kørsel:
 *   npm run import-hotels -- path/to/hotelliste.xlsx
 *
 * Scriptet:
 *   1. Parser Excel-filen og filtrerer ugyldige rækker
 *   2. Geocoder hver hotel via Nominatim (~1 sek pr. hotel)
 *   3. Upserter til hotels-tabellen
 *
 * Kræver SUPABASE_SERVICE_ROLE_KEY i .env.local fordi vi skriver direkte
 * til tabellen uden RLS-context.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseHotelList } from "@/lib/hotels/parseHotelList";
import { geocodeWithCache } from "@/lib/geocoding/geocodeWithCache";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Brug: npm run import-hotels -- path/to/hotelliste.xlsx");
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Filen findes ikke: ${absolutePath}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Manglende miljøvariabler. Sæt NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i .env.local",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log(`Læser ${absolutePath}…`);
  const buffer = fs.readFileSync(absolutePath);
  const { hotels, excluded } = parseHotelList(buffer);

  console.log(`${hotels.length} hoteller at importere`);
  console.log(`${excluded.length} ekskluderet (LUKKET, test, osv.)`);

  let imported = 0;
  let failedGeocode = 0;

  for (let i = 0; i < hotels.length; i++) {
    const hotel = hotels[i];
    process.stdout.write(
      `[${i + 1}/${hotels.length}] ${hotel.name} (${hotel.postalCode} ${hotel.city})… `,
    );

    const geo = await geocodeWithCache(
      supabase,
      hotel.address,
      hotel.postalCode,
      hotel.city,
    );
    if (!geo.coords) {
      console.log("GEOCODE FEJL");
      failedGeocode++;
      continue;
    }

    const { error } = await supabase.from("hotels").upsert({
      name: hotel.name,
      address: hotel.address,
      postal_code: hotel.postalCode,
      city: hotel.city,
      municipality: hotel.municipality,
      area: hotel.area,
      has_agreement: hotel.hasAgreement,
      single_room_price: hotel.singleRoomPrice != null ? Math.round(hotel.singleRoomPrice) : null,
      double_room_price: hotel.doubleRoomPrice != null ? Math.round(hotel.doubleRoomPrice) : null,
      checkin_after: hotel.checkinAfter,
      checkout_before: hotel.checkoutBefore,
      breakfast_included: hotel.breakfastIncluded,
      parking: hotel.parking,
      notes: hotel.notes,
      is_active: true,
      lat: geo.coords.lat,
      lng: geo.coords.lng,
    });

    if (error) {
      console.log(`DB-FEJL: ${error.message}`);
    } else {
      console.log("OK");
      imported++;
    }
  }

  console.log("\n──────────────");
  console.log(`Importeret: ${imported}`);
  console.log(`Geocode-fejl: ${failedGeocode}`);
  console.log(`Ekskluderet: ${excluded.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
