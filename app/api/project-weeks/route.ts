import { NextResponse } from "next/server";
import { getProjectWeeksMap } from "@/lib/excel/schoolLookup";

/**
 * GET /api/project-weeks
 * Returnerer projektuge-map som { "skolenavn|kommune": "uger" }.
 * Ingen persondata — kun skole, kommune og projektuger fra Skoler2627.xlsx.
 */
export async function GET() {
  const map = getProjectWeeksMap();
  return NextResponse.json(Object.fromEntries(map));
}
