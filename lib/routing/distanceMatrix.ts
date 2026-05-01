import type { GeoCoords } from "@/types/concert";
import { getTable } from "./osrm";

/**
 * Haversine-afstand i meter mellem to punkter (fugleflugt).
 * Bruges som fallback hvis OSRM er utilgængelig og til hurtig
 * nærmeste-nabo-sortering inden OSRM-opslag.
 */
export function haversineMeters(a: GeoCoords, b: GeoCoords): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type DistanceMatrix = {
  /** distances[i][j] = meter */
  distances: number[][];
  /** durations[i][j] = sekunder */
  durations: number[][];
};

/**
 * Hent N×N afstandsmatrix for en liste af punkter.
 * Cacher resultatet pr. unik punktliste (samme rækkefølge → samme matrix).
 * OSRM /table dækker alle par i ét kald.
 */
export async function computeDistanceMatrix(
  points: GeoCoords[],
): Promise<DistanceMatrix> {
  if (points.length < 2) {
    return { distances: [[0]], durations: [[0]] };
  }
  const { distances, durations } = await getTable(points);
  return { distances, durations };
}

/**
 * Total rute-distance i meter for en given rækkefølge af indekser
 * ind i en distance-matrix.
 */
export function totalDistance(
  order: number[],
  matrix: Pick<DistanceMatrix, "distances">,
): number {
  let sum = 0;
  for (let i = 0; i < order.length - 1; i++) {
    sum += matrix.distances[order[i]][order[i + 1]];
  }
  return sum;
}
