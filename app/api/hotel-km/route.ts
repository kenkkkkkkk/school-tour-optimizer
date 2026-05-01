import { NextResponse } from "next/server";
import { z } from "zod";
import { getTable } from "@/lib/routing/osrm";

const CoordSchema = z.object({ lat: z.number(), lng: z.number() });
const BodySchema = z.object({
  legs: z.array(z.object({ from: CoordSchema, to: CoordSchema })),
});

/**
 * POST /api/hotel-km
 * Returnerer OSRM vejdistancer (meter) for en liste af hotel↔skole-ben.
 * Alle koordinater samles i ét /table-kald for minimal latency.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { legs } = parsed.data;
    if (legs.length === 0) {
      return NextResponse.json({ distances: [] });
    }

    // Byg unik punkt-liste for at minimere matrixstørrelse
    const pointMap = new Map<string, number>();
    const points: { lat: number; lng: number }[] = [];

    function addPoint(p: { lat: number; lng: number }): number {
      const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      if (!pointMap.has(key)) {
        pointMap.set(key, points.length);
        points.push(p);
      }
      return pointMap.get(key)!;
    }

    const legIndices = legs.map((l) => ({
      fromIdx: addPoint(l.from),
      toIdx: addPoint(l.to),
    }));

    const table = await getTable(points);
    const distances = legIndices.map(({ fromIdx, toIdx }) => table.distances[fromIdx][toIdx]);

    return NextResponse.json({ distances });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
