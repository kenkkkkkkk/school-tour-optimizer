import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/hotels?area=Område+1+...
 * Returnerer aktive hoteller, filtreret på område hvis angivet.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");

  const supabase = createSupabaseServerClient();
  let query = supabase.from("hotels").select("*").eq("is_active", true);
  if (area) {
    query = query.eq("area", area);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
