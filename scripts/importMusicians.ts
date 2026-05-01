/**
 * Engangs-import: læser EksportMedlemmer.xlsx og upserts i Supabase.
 * Kør med: npx ts-node --project tsconfig.scripts.json scripts/importMusicians.ts
 *
 * Kræver env-variabler:
 *   SUPABASE_URL            (eller NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Mangler SUPABASE_URL og/eller SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const filePath = path.join(process.cwd(), "EksportMedlemmer.xlsx");
  const wb = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[wb.SheetNames[0]],
    { defval: "" },
  );

  const records = rows
    .filter((r) => r["Musikgruppe"] && r["Produktion"])
    .map((r) => ({
      band_name: String(r["Musikgruppe"]).trim(),
      production_name: String(r["Produktion"]).trim(),
      first_name: String(r["Fornavn"] ?? "").trim(),
      last_name: String(r["Efternavn"] ?? "").trim(),
      address: String(r["Adresse"] ?? "").trim(),
      postal_code: String(r["Postnummer"] ?? "").trim(),
      city: String(r["By"] ?? "").trim(),
    }));

  console.log(`Fandt ${records.length} musikere i Excel-filen`);

  const { error } = await supabase
    .from("musicians")
    .upsert(records, {
      onConflict: "band_name,production_name,first_name,last_name",
    });

  if (error) {
    console.error("Fejl ved upsert:", error.message);
    process.exit(1);
  }

  console.log(`Importeret ${records.length} musikere til Supabase`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
