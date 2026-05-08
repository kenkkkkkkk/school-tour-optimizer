"use client";

import { create } from "zustand";
import type { TourDay, ConcertStop, PlanningWarning } from "@/types/concert";
import type { Hotel } from "@/types/hotel";
import type { Musician } from "@/types/musician";
import { dateOnlyISO } from "@/lib/excel/excelDate";
import { totalDistance, type DistanceMatrix } from "@/lib/routing/distanceMatrix";

export type TourState = {
  bandName: string;
  productionName: string;
  musicians: Musician[];
  showMusicians: boolean;
  days: TourDay[];
  allHotels: Hotel[];
  warnings: PlanningWarning[];
  totalKm: number;
  /** N×N matrix over alle geocodede stops (bruges til live km ved drag) */
  distanceMatrix: DistanceMatrix | null;
  /** Indeks fra stop-id → matrixposition */
  matrixIndexByStopId: Map<string, number>;
  /** Hvilke dage der har hover/fokus i sidebar */
  hoveredDayIndex: number | null;
  /** Hvilken dag der er valgt i sidebar (for hotel-visning på kort) */
  selectedDayIndex: number | null;
  /** Tidligere dage-tilstande til fortryd — maks. 20 trin */
  history: TourDay[][];
  /** OSRM-vejdistancer for hotel↔skole-ben (meter). Udfyldes ved "Beregn km". */
  hotelLegDistances: Map<string, number>;
  /** OSRM-vejdistancer for musiker-hjem → første stop pr. dag (meter). Nøgle: `${musicianId}_${dayIndex}` */
  musicianLegDistances: Map<string, number>;
  /** Overnatning aftenen før første turnédag */
  preTourNight: {
    requiresHotel: boolean;
    suggestedHotelId: string | null;
    selectedHotelId: string | null;
  };
  /** Slår alle drag-advarsler fra når true */
  suppressWarnings: boolean;
  /** Hvilken visning der vises i sidebaren — "route" (geografi) eller "hotels" (overnatning) */
  viewMode: "route" | "hotels";

  // Mutations
  setTour: (
    bandName: string,
    productionName: string,
    days: TourDay[],
    warnings: PlanningWarning[],
    matrix: DistanceMatrix,
    indexMap: Map<string, number>,
  ) => void;
  setAllHotels: (hotels: Hotel[]) => void;
  reorderWithinDay: (dayIndex: number, fromIdx: number, toIdx: number) => void;
  moveBetweenDays: (
    fromDayIndex: number,
    fromIdx: number,
    toDayIndex: number,
    toIdx: number,
  ) => void;
  selectHotel: (dayIndex: number, hotelId: string) => void;
  toggleHotelRequired: (dayIndex: number) => void;
  reorderDays: (fromIndex: number, toIndex: number) => void;
  swapDays: (fromIndex: number, toIndex: number) => void;
  recalcAllKm: () => void;
  undo: () => void;
  setHoveredDay: (dayIndex: number | null) => void;
  setSelectedDay: (dayIndex: number | null) => void;
  togglePreTourHotel: () => void;
  selectPreTourHotel: (hotelId: string) => void;
  toggleSuppressWarnings: () => void;
  setViewMode: (mode: "route" | "hotels") => void;
  setMusicians: (musicians: Musician[]) => void;
  toggleShowMusicians: () => void;
  setMusicianLegDistances: (distances: Map<string, number>) => void;
  toggleLockStop: (dayIndex: number, tourOrder: number) => void;
  toggleLockDay: (dayIndex: number) => void;
  /** Originale stops fra upload — bruges til Nulstil */
  originalStops: ConcertStop[] | null;
  setOriginalStops: (stops: ConcertStop[]) => void;
  resetToOriginal: () => void;
};

export const useTourStore = create<TourState>((set) => ({
  bandName: "",
  productionName: "",
  musicians: [],
  showMusicians: true,
  days: [],
  allHotels: [],
  warnings: [],
  totalKm: 0,
  distanceMatrix: null,
  matrixIndexByStopId: new Map(),
  hoveredDayIndex: null,
  selectedDayIndex: null,
  history: [],
  preTourNight: { requiresHotel: false, suggestedHotelId: null, selectedHotelId: null },
  hotelLegDistances: new Map(),
  musicianLegDistances: new Map(),
  suppressWarnings: false,
  viewMode: "route",
  originalStops: null,

  setTour: (bandName, productionName, days, warnings, matrix, indexMap) => {
    const totalKm = sumTotalKm(days);
    set({
      bandName, productionName, days, warnings, totalKm,
      distanceMatrix: matrix, matrixIndexByStopId: indexMap, history: [],
      preTourNight: { requiresHotel: false, suggestedHotelId: null, selectedHotelId: null },
      hotelLegDistances: new Map(),
      musicianLegDistances: new Map(),
    });
  },

  setAllHotels: (hotels) => set({ allHotels: hotels }),

  reorderWithinDay: (dayIndex, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    set((state) => {
      const schools = state.days[dayIndex].schools;
      const lo = Math.min(fromIdx, toIdx);
      const hi = Math.max(fromIdx, toIdx);
      // Afbryd hvis et låst stop ligger i det område der ville blive forskudt
      if (schools.slice(lo, hi + 1).some((s) => s.locked)) return state;
      const history = [...state.history.slice(-19), cloneDays(state.days)];
      const days = cloneDays(state.days);
      const daySchools = days[dayIndex].schools;
      const [moved] = daySchools.splice(fromIdx, 1);
      daySchools.splice(toIdx, 0, moved);
      daySchools.forEach((s, i) => { s.dayOrder = i; });
      days[dayIndex].kmThisDay = recalcDayKm(days, dayIndex, state);
      const totalKm = sumTotalKm(days);
      return { days, totalKm, history };
    });
  },

  moveBetweenDays: (fromDayIndex, fromIdx, toDayIndex, toIdx) => {
    set((state) => {
      // Afbryd hvis det stop der trækkes er låst
      if (state.days[fromDayIndex].schools[fromIdx]?.locked) return state;
      // Afbryd hvis et låst stop i måldagen ville blive skubbet af indsætningen
      if (state.days[toDayIndex].schools.some((s, idx) => s.locked && idx >= toIdx)) return state;
      const history = [...state.history.slice(-19), cloneDays(state.days)];
      const days = cloneDays(state.days);
      const [movedRaw] = days[fromDayIndex].schools.splice(fromIdx, 1);
      // Spread for at undgå mutation af delt skole-objekt (vigtig for undo-snapshots)
      const moved = { ...movedRaw, concertDate: days[toDayIndex].date };
      days[toDayIndex].schools.splice(toIdx, 0, moved);
      days[fromDayIndex].schools.forEach((s, i) => { s.dayOrder = i; });
      days[toDayIndex].schools.forEach((s, i) => { s.dayOrder = i; });
      days[fromDayIndex].kmThisDay = recalcDayKm(days, fromDayIndex, state);
      days[toDayIndex].kmThisDay = recalcDayKm(days, toDayIndex, state);
      const totalKm = sumTotalKm(days);
      return { days, totalKm, history };
    });
  },

  selectHotel: (dayIndex, hotelId) => {
    set((state) => {
      const days = cloneDays(state.days);
      days[dayIndex].selectedHotelId = hotelId;
      return { days };
    });
  },

  toggleHotelRequired: (dayIndex) => {
    set((state) => {
      const days = cloneDays(state.days);
      days[dayIndex].requiresHotel = !days[dayIndex].requiresHotel;
      // Ryd valgt hotel hvis overnatning slås fra
      if (!days[dayIndex].requiresHotel) {
        days[dayIndex].selectedHotelId = null;
        days[dayIndex].suggestedHotelId = null;
      }
      return { days };
    });
  },

  reorderDays: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    set((state) => {
      // Afbryd kun hvis den dag der TRÆKKES selv har låste koncerter
      // (låste dage i spændet er ok — de beholder blot deres dato som fastpunkter)
      if (state.days[fromIndex].schools.some((s) => s.locked)) return state;
      const history = [...state.history.slice(-19), cloneDays(state.days)];
      const days = cloneDays(state.days);
      const lo = Math.min(fromIndex, toIndex);
      const hi = Math.max(fromIndex, toIndex);
      // Gem de originale datoer i positional rækkefølge
      const dates = days.map((d) => d.date);
      const [moved] = days.splice(fromIndex, 1);
      days.splice(toIndex, 0, moved);
      // Dato-tildeling: låste dage i [lo, hi] beholder deres egen dato som fastpunkt.
      // De resterende datoer fra range-puljen fordeles til ikke-låste dage i orden.
      const lockedTimes = new Set<number>();
      for (let i = lo; i <= hi; i++) {
        if (days[i].schools.some((s) => s.locked)) lockedTimes.add(days[i].date.getTime());
      }
      const available = dates.slice(lo, hi + 1).filter((d) => !lockedTimes.has(d.getTime()));
      let ai = 0;
      for (let i = lo; i <= hi; i++) {
        if (!days[i].schools.some((s) => s.locked)) {
          const d = available[ai++];
          days[i].date = d;
          days[i].schools = days[i].schools.map((s) => ({ ...s, concertDate: d }));
        }
      }
      // Re-sortér kronologisk så sidebaren aldrig viser dage i forkert dato-rækkefølge
      days.sort((a, b) => a.date.getTime() - b.date.getTime());
      return { days, totalKm: sumTotalKm(days), selectedDayIndex: null, history };
    });
  },

  swapDays: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    set((state) => {
      const history = [...state.history.slice(-19), cloneDays(state.days)];
      const days = cloneDays(state.days);
      const dateFrom = days[fromIndex].date;
      const dateTo = days[toIndex].date;
      days[fromIndex].date = dateTo;
      days[fromIndex].schools = days[fromIndex].schools.map((s) => ({ ...s, concertDate: dateTo }));
      days[toIndex].date = dateFrom;
      days[toIndex].schools = days[toIndex].schools.map((s) => ({ ...s, concertDate: dateFrom }));
      days.sort((a, b) => a.date.getTime() - b.date.getTime());
      days.forEach((_, i) => { days[i].kmThisDay = recalcDayKm(days, i, state); });
      return { days, totalKm: sumTotalKm(days), selectedDayIndex: null, history };
    });
  },

  recalcAllKm: () => {
    set((state) => {
      if (!state.distanceMatrix) return state;
      const days = cloneDays(state.days);
      days.forEach((_, i) => { days[i].kmThisDay = recalcDayKm(days, i, state); });
      return { days, totalKm: sumTotalKm(days) };
    });
  },

  undo: () => {
    set((state) => {
      if (state.history.length === 0) return state;
      const history = [...state.history];
      const days = history.pop()!;
      return { days, totalKm: sumTotalKm(days), history };
    });
  },

  setHoveredDay: (dayIndex) => set({ hoveredDayIndex: dayIndex }),
  setSelectedDay: (dayIndex) => set({ selectedDayIndex: dayIndex }),

  togglePreTourHotel: () => {
    set((state) => {
      const requiresHotel = !state.preTourNight.requiresHotel;
      return {
        preTourNight: requiresHotel
          ? { ...state.preTourNight, requiresHotel: true }
          : { requiresHotel: false, suggestedHotelId: null, selectedHotelId: null },
      };
    });
  },

  selectPreTourHotel: (hotelId) => {
    set((state) => ({
      preTourNight: { ...state.preTourNight, selectedHotelId: hotelId },
    }));
  },

  toggleSuppressWarnings: () => set((state) => ({ suppressWarnings: !state.suppressWarnings })),

  setMusicians: (musicians) => set({ musicians }),
  toggleShowMusicians: () => set((state) => ({ showMusicians: !state.showMusicians })),
  setMusicianLegDistances: (distances) => set({ musicianLegDistances: distances }),
  toggleLockStop: (dayIndex, tourOrder) => {
    set((state) => {
      const days = cloneDays(state.days);
      const stop = days[dayIndex].schools.find((s) => s.tourOrder === tourOrder);
      if (stop) stop.locked = !stop.locked;
      return { days };
    });
  },

  toggleLockDay: (dayIndex) => {
    set((state) => {
      const days = cloneDays(state.days);
      const schools = days[dayIndex].schools;
      const allLocked = schools.length > 0 && schools.every((s) => s.locked);
      schools.forEach((s) => { s.locked = !allLocked; });
      return { days };
    });
  },

  setOriginalStops: (stops) => set({ originalStops: stops }),

  resetToOriginal: () => {
    set((state) => {
      if (!state.originalStops || !state.distanceMatrix) return state;

      // Gruppér stops efter original dato, sortér inden for dagen efter tourOrder
      const grouped = new Map<string, ConcertStop[]>();
      for (const stop of state.originalStops) {
        const key = dateOnlyISO(stop.concertDate);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push({ ...stop, locked: false });
      }

      const sortedDates = [...grouped.keys()].sort();
      const days: TourDay[] = sortedDates.map((key) => {
        const schools = [...(grouped.get(key) ?? [])].sort((a, b) => a.tourOrder - b.tourOrder);
        schools.forEach((s, i) => { s.dayOrder = i; });
        return {
          date: schools[0].concertDate,
          schools,
          kmThisDay: 0,
          requiresHotel: false,
          suggestedHotelId: null,
          selectedHotelId: null,
        };
      });

      const stateForKm = {
        distanceMatrix: state.distanceMatrix,
        matrixIndexByStopId: state.matrixIndexByStopId,
      };
      days.forEach((_, i) => { days[i].kmThisDay = recalcDayKm(days, i, stateForKm); });

      return {
        days,
        totalKm: sumTotalKm(days),
        history: [],
        preTourNight: { requiresHotel: false, suggestedHotelId: null, selectedHotelId: null },
        hotelLegDistances: new Map(),
        selectedDayIndex: null,
      };
    });
  },

  setViewMode: (mode) => set((state) => ({
    viewMode: mode,
    // Skjul hoteller på kortet når man går tilbage til rute-mode
    selectedDayIndex: mode === "route" ? null : state.selectedDayIndex,
  })),
}));

// ──────────────────────────────────────────────────────────────
// Hjælpefunktioner
// ──────────────────────────────────────────────────────────────

function cloneDays(days: TourDay[]): TourDay[] {
  return days.map((d) => ({ ...d, schools: [...d.schools] }));
}

function sumTotalKm(days: TourDay[]): number {
  return Math.round(days.reduce((acc, d) => acc + d.kmThisDay, 0) * 10) / 10;
}


function recalcDayKm(
  days: TourDay[],
  dayIndex: number,
  state: Pick<TourState, "distanceMatrix" | "matrixIndexByStopId">,
): number {
  const matrix = state.distanceMatrix;
  const indexMap = state.matrixIndexByStopId;
  if (!matrix) return days[dayIndex].kmThisDay;

  const schools = days[dayIndex].schools.filter(
    (s) => s.lat !== null && s.lng !== null,
  );
  if (schools.length === 0) return 0;

  const schoolIndices = schools
    .map((s) => indexMap.get(String(s.tourOrder)) ?? null)
    .filter((i): i is number => i !== null);
  if (schoolIndices.length === 0) return 0;

  // Skole-til-skole inden for dagen (OSRM-matrix)
  let meters = schoolIndices.length > 1 ? totalDistance(schoolIndices, matrix) : 0;

  // Startben: sidst fra forrige dag → dagens første skole — kun hvis dagene er
  // kalender-naboer (datoforskel = 1 dag). Pauser/weekend bryder blokken.
  if (dayIndex > 0) {
    const dayDiff = Math.round(
      (days[dayIndex].date.getTime() - days[dayIndex - 1].date.getTime()) / 86400000,
    );
    if (dayDiff === 1) {
      const prevSchools = days[dayIndex - 1].schools.filter((s) => s.lat !== null && s.lng !== null);
      const lastPrev = prevSchools[prevSchools.length - 1];
      if (lastPrev) {
        const prevIdx = indexMap.get(String(lastPrev.tourOrder)) ?? null;
        if (prevIdx !== null) meters += matrix.distances[prevIdx][schoolIndices[0]];
      }
    }
  }

  return Math.round(meters / 100) / 10;
}

/** Hjælper til UI: returnér dag-farve-klasse (Tailwind) for dag-index */
export function dayColorClass(dayIndex: number): string {
  const colors = [
    "bg-red-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-indigo-500",
    "bg-cyan-500",
  ];
  return colors[dayIndex % colors.length];
}

/** Tailwind text-color for dag-index */
export function dayTextClass(dayIndex: number): string {
  return dayColorClass(dayIndex).replace("bg-", "text-");
}

/** Hex-farve for dag-index — bruges til Leaflet marker-ikoner */
export function dayHexColor(dayIndex: number): string {
  const colors = [
    "#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#06b6d4",
  ];
  return colors[dayIndex % colors.length];
}

/** ISO-dato-nøgle for en TourDay */
export function dayKey(day: TourDay): string {
  return dateOnlyISO(day.date);
}
