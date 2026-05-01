import type {
  ConcertStop,
  GeoCoords,
  PlanningWarning,
  TourDay,
} from "@/types/concert";
import { dateOnlyISO } from "@/lib/excel/excelDate";
import {
  haversineMeters,
  type DistanceMatrix,
} from "./distanceMatrix";
import {
  MAX_SCHOOLS_PER_DAY,
  MAX_SCHOOLS_WITH_EVENING,
} from "./constraints";

export type OptimizeInput = {
  stops: ConcertStop[];
  /** Matrix over alle stops — matrix[i][j] er afstand fra stop i til stop j */
  matrix: DistanceMatrix;
  /** Musikernes bopæl — bruges som startpunkt første dag hvis angivet */
  homeBase?: GeoCoords;
};

export type OptimizeResult = {
  days: TourDay[];
  totalKm: number;
  warnings: PlanningWarning[];
};

/**
 * HARD CONSTRAINT: Datoerne OG rækkefølgen fra Excel er fikserede.
 * Algoritmen grupperer blot skoler efter den eksisterende concert_date
 * uden at omflytte dem — planlæggeren styrer selv rækkefølgen via drag-and-drop.
 *
 * Trin:
 *   1. Gruppér stops efter concertDate (ISO-dato uden tid)
 *   2. Bevar Excel-rækkefølgen (tourOrder) inden for hver dag
 *   3. Beregn distancer og valider constraints
 */
export function optimizeTour(input: OptimizeInput): OptimizeResult {
  const { stops, matrix, homeBase } = input;
  const warnings: PlanningWarning[] = [];

  // Stops uden koordinater kan ikke indgå i ruten — flag dem og fortsæt
  const geocoded = stops.filter((s) => s.lat !== null && s.lng !== null);
  for (const s of stops) {
    if (s.lat === null || s.lng === null) {
      warnings.push({
        type: "missing_geocode",
        message: `${s.schoolName} mangler koordinater — ekskluderet fra ruteberegning`,
        schoolId: s.id,
      });
    }
  }

  // Byg indeks fra stop → matrix-position.
  // VIGTIGT: matrixen er bygget fra 'geocoded' (kun geocodede stops, 0-baseret),
  // så indekserne skal matche 'geocoded', ikke 'stops'.
  const indexByStop = new Map<ConcertStop, number>();
  geocoded.forEach((s, i) => indexByStop.set(s, i));

  // Gruppér ALLE stops efter dato (inkl. dem uden koordinater)
  const stopsByDate = new Map<string, ConcertStop[]>();
  for (const s of stops) {
    const key = dateOnlyISO(s.concertDate);
    const bucket = stopsByDate.get(key) ?? [];
    bucket.push(s);
    stopsByDate.set(key, bucket);
  }

  // Sortér datoer kronologisk
  const sortedDates = [...stopsByDate.keys()].sort();
  const days: TourDay[] = [];
  let prevLastStop: ConcertStop | null = null;
  let totalMeters = 0;

  for (const dateKey of sortedDates) {
    const allDaySchools = stopsByDate.get(dateKey)!;
    const geocodedDaySchools = allDaySchools.filter(
      (s) => s.lat !== null && s.lng !== null,
    );
    const nonGeocodedDaySchools = allDaySchools.filter(
      (s) => s.lat === null || s.lng === null,
    );

    // Bestem startpunkt: hjembase første dag, ellers forrige dags sidste geocodede stop
    const startCoord: GeoCoords | null =
      prevLastStop !== null
        ? { lat: prevLastStop.lat!, lng: prevLastStop.lng! }
        : homeBase ?? null;
    const prevStartIndex =
      prevLastStop !== null ? (indexByStop.get(prevLastStop) ?? null) : null;

    // Bevar Excel-rækkefølgen inden for hver dag (sortér på tourOrder for sikkerhed).
    // Planlæggeren omfordeler selv via drag-and-drop.
    const orderedGeocodedSchools: ConcertStop[] = [...geocodedDaySchools].sort(
      (a, b) => a.tourOrder - b.tourOrder,
    );

    const dayMeters = computeDayMeters(
      orderedGeocodedSchools,
      matrix,
      indexByStop,
      startCoord,
      prevStartIndex,
    );

    // Geocodede (optimeret rækkefølge) + ikke-geocodede (sidst)
    const orderedSchools = [...orderedGeocodedSchools, ...nonGeocodedDaySchools];

    // Tildel dayOrder
    orderedSchools.forEach((s, idx) => {
      s.dayOrder = idx;
    });

    // Constraint-advarsler
    const hasEvening = orderedSchools.some((s) => s.isEveningConcert);
    const maxForDay = hasEvening
      ? MAX_SCHOOLS_WITH_EVENING
      : MAX_SCHOOLS_PER_DAY;
    if (orderedSchools.length > maxForDay) {
      warnings.push({
        type: "too_many_schools",
        message: `${dateKey}: ${orderedSchools.length} skoler (max ${maxForDay}${hasEvening ? " med aftenkoncert" : ""})`,
        date: dateKey,
      });
    }

    // Check om sidste DAG-koncert starter efter 12:00
    const dayConcerts = orderedSchools.filter((s) => !s.isEveningConcert);
    const latestDayConcert = dayConcerts.reduce<ConcertStop | null>(
      (latest, s) =>
        !latest || s.concertTime > latest.concertTime ? s : latest,
      null,
    );
    if (latestDayConcert && latestDayConcert.concertTime > "12:00") {
      warnings.push({
        type: "late_start",
        message: `${dateKey}: sidste dagkoncert starter ${latestDayConcert.concertTime} — efter 12:00`,
        date: dateKey,
      });
    }

    days.push({
      date: allDaySchools[0].concertDate,
      schools: orderedSchools,
      kmThisDay: Math.round(dayMeters / 100) / 10,
      requiresHotel: false,
      suggestedHotelId: null,
      selectedHotelId: null,
    });

    totalMeters += dayMeters;
    // Opdater kun prevLastStop fra geocodede stops
    if (orderedGeocodedSchools.length > 0) {
      prevLastStop = orderedGeocodedSchools[orderedGeocodedSchools.length - 1];
    }
  }

  // requiresHotel sættes IKKE automatisk — planlæggeren bestemmer selv
  // via hotel-toggle i UI for hver dag.

  return {
    days,
    totalKm: Math.round(totalMeters / 100) / 10,
    warnings,
  };
}

function computeDayMeters(
  orderedSchools: ConcertStop[],
  matrix: DistanceMatrix,
  indexByStop: Map<ConcertStop, number>,
  startCoord: GeoCoords | null,
  startIndex: number | null,
): number {
  if (orderedSchools.length === 0) return 0;
  let meters = 0;

  // Leg fra startpunkt til første skole
  const firstIdx = indexByStop.get(orderedSchools[0])!;
  if (startIndex !== null) {
    meters += matrix.distances[startIndex][firstIdx];
  } else if (startCoord !== null) {
    meters += haversineMeters(startCoord, {
      lat: orderedSchools[0].lat!,
      lng: orderedSchools[0].lng!,
    });
  }

  // Legs mellem skoler
  for (let i = 0; i < orderedSchools.length - 1; i++) {
    const from = indexByStop.get(orderedSchools[i])!;
    const to = indexByStop.get(orderedSchools[i + 1])!;
    meters += matrix.distances[from][to];
  }
  return meters;
}
