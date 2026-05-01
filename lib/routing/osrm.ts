import type { GeoCoords } from "@/types/concert";

/**
 * OSRM-klient til /route og /table endpoints.
 * Bruger den offentlige demo-server (router.project-osrm.org) som default.
 */
const DEFAULT_BASE_URL = "https://router.project-osrm.org";

function getBaseUrl(): string {
  return process.env.OSRM_BASE_URL ?? DEFAULT_BASE_URL;
}

/**
 * Formatér koordinater som "lng,lat;lng,lat;..." — OSRM bruger lng først.
 */
function formatCoords(points: GeoCoords[]): string {
  return points.map((p) => `${p.lng},${p.lat}`).join(";");
}

export type RouteResult = {
  distanceM: number;
  durationS: number;
  /** GeoJSON LineString koordinater (lng,lat par) til tegning på kortet */
  geometry: Array<[number, number]>;
};

/**
 * Beregn køreafstand + geometri mellem N punkter (i rækkefølge).
 * Bruges til at tegne den faktiske rute på kortet.
 */
export async function getRoute(points: GeoCoords[]): Promise<RouteResult> {
  if (points.length < 2) {
    throw new Error("getRoute kræver mindst 2 punkter");
  }
  const url = `${getBaseUrl()}/route/v1/driving/${formatCoords(points)}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM /route HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    code: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: Array<[number, number]> };
    }>;
  };
  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(`OSRM-fejl: ${data.code}`);
  }
  const route = data.routes[0];
  return {
    distanceM: route.distance,
    durationS: route.duration,
    geometry: route.geometry.coordinates,
  };
}

export type TableResult = {
  /** durations[i][j] = sekunder fra punkt i til punkt j */
  durations: number[][];
  /** distances[i][j] = meter fra punkt i til punkt j */
  distances: number[][];
};

/**
 * Hent N×N matrix af afstande og køretider.
 * Ét kald dækker alle par — meget hurtigere end N² individuelle /route kald.
 */
export async function getTable(points: GeoCoords[]): Promise<TableResult> {
  if (points.length < 2) {
    throw new Error("getTable kræver mindst 2 punkter");
  }
  const url = `${getBaseUrl()}/table/v1/driving/${formatCoords(points)}?annotations=duration,distance`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM /table HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    code: string;
    durations?: number[][];
    distances?: number[][];
  };
  if (data.code !== "Ok" || !data.durations || !data.distances) {
    throw new Error(`OSRM-fejl: ${data.code}`);
  }
  return { durations: data.durations, distances: data.distances };
}
