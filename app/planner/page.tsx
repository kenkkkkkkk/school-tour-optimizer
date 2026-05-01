"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { TourList } from "@/components/sidebar/TourList";
import { StatusBar } from "@/components/header/StatusBar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useTourStore } from "@/lib/store/tourStore";
import type { TourDay, ConcertStop } from "@/types/concert";
import type { Hotel } from "@/types/hotel";
import type { Musician } from "@/types/musician";
import type { DistanceMatrix } from "@/lib/routing/distanceMatrix";

// Leaflet importeres kun client-side
const TourMap = dynamic(
  () => import("@/components/map/TourMap").then((m) => m.TourMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-gray-100" /> },
);

type OptimizeResponse = {
  days: Array<{
    date: string;
    schools: Array<Omit<ConcertStop, "concertDate"> & { concertDate: string }>;
    kmThisDay: number;
    requiresHotel: boolean;
    suggestedHotelId: string | null;
    selectedHotelId: string | null;
  }>;
  totalKm: number;
  warnings: unknown[];
  hotels: Hotel[];
  matrix: DistanceMatrix;
};

export default function PlannerPage() {
  const setTour = useTourStore((s) => s.setTour);
  const setAllHotels = useTourStore((s) => s.setAllHotels);
  const setMusicians = useTourStore((s) => s.setMusicians);
  const setMusicianLegDistances = useTourStore((s) => s.setMusicianLegDistances);
  const setOriginalStops = useTourStore((s) => s.setOriginalStops);
  const resetToOriginal = useTourStore((s) => s.resetToOriginal);
  const days = useTourStore((s) => s.days);
  const recalcAllKm = useTourStore((s) => s.recalcAllKm);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStops, setPendingStops] = useState<ConcertStop[] | null>(null);
  const [pendingBandName, setPendingBandName] = useState("");
  const [pendingProductionName, setPendingProductionName] = useState("");

  // Sidebar-bredde i procent — trækkes med drag-håndtag
  const [sidebarPct, setSidebarPct] = useState(35);
  const splitRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMove = (mv: MouseEvent) => {
      if (!isDragging.current || !splitRef.current) return;
      const { left, width } = splitRef.current.getBoundingClientRect();
      const newSidebarPct = ((left + width - mv.clientX) / width) * 100;
      setSidebarPct(Math.min(60, Math.max(20, newSidebarPct)));
    };

    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Stops kan sendes via sessionStorage fra upload-siden
  useEffect(() => {
    const raw = sessionStorage.getItem("lms_parsed_stops");
    if (raw) {
      try {
        const stops: Array<Omit<ConcertStop, "concertDate"> & { concertDate: string }> = JSON.parse(raw);
        const parsed = stops.map((s) => ({ ...s, concertDate: new Date(s.concertDate) }));
        setPendingStops(parsed);
        setOriginalStops(parsed);
        setPendingBandName(sessionStorage.getItem("lms_band_name") ?? "");
        setPendingProductionName(sessionStorage.getItem("lms_production_name") ?? "");
        sessionStorage.removeItem("lms_parsed_stops");
        sessionStorage.removeItem("lms_band_name");
        sessionStorage.removeItem("lms_production_name");
      } catch {
        // ignore
      }
    }
  }, [setOriginalStops]);

  const runOptimize = useCallback(
    async (stops: ConcertStop[]) => {
      setIsOptimizing(true);
      setError(null);
      try {
        const res = await fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stops: stops.map((s) => ({ ...s, concertDate: s.concertDate.toISOString() })) }),
        });
        const data: OptimizeResponse | { error: string } = await res.json();
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Ukendt fejl");
        }

        const tourDays: TourDay[] = data.days.map((d) => ({
          ...d,
          date: new Date(d.date),
          schools: d.schools.map((s) => ({ ...s, concertDate: new Date(s.concertDate) })),
        }));

        const indexMap = new Map<string, number>();
        stops.filter((s) => s.lat && s.lng).forEach((s, i) => {
          indexMap.set(String(s.tourOrder), i);
        });

        setTour(
          pendingBandName,
          pendingProductionName,
          tourDays,
          [],
          data.matrix,
          indexMap,
        );
        setAllHotels(data.hotels);

        // Match og geocod kun de musikere der tilhører dette band+produktion,
        // beregn derefter vejafstande hjem → første stop pr. dag
        geocodeMatchedMusicians(pendingBandName, pendingProductionName, tourDays, setMusicians, setMusicianLegDistances);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl under optimering");
      } finally {
        setIsOptimizing(false);
      }
    },
    [setTour, setAllHotels, setMusicians, setMusicianLegDistances, pendingBandName, pendingProductionName],
  );

  // Auto-start optimering hvis stops venter
  useEffect(() => {
    if (pendingStops && pendingStops.length > 0) {
      runOptimize(pendingStops);
      setPendingStops(null);
    }
  }, [pendingStops, runOptimize]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <StatusBar onReoptimize={days.length > 0 ? resetToOriginal : undefined} isOptimizing={isOptimizing} />

      {/* Fejl-banner */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {/* Hoved-split-layout */}
      <div ref={splitRef} className="flex min-h-0 flex-1">
        {/* Kort (venstre) */}
        <div className="relative min-h-0" style={{ width: `${100 - sidebarPct}%` }}>
          {isOptimizing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-6 shadow-lg">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-gray-600">Vent et øjeblik…</p>
              </div>
            </div>
          )}
          <TourMap />
        </div>

        {/* Drag-håndtag */}
        <div
          onMouseDown={handleDividerMouseDown}
          className="group relative z-10 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-gray-200 hover:bg-blue-400 active:bg-blue-500"
        >
          <div className="h-8 w-0.5 rounded-full bg-gray-400 group-hover:bg-white" />
        </div>

        {/* Sidebar (højre) */}
        <div className="flex min-h-0 flex-col border-l border-gray-200 bg-white" style={{ width: `${sidebarPct}%` }}>
          {days.length === 0 && !isOptimizing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-sm text-gray-500">
                Ingen turné indlæst endnu.
              </p>
              <Button variant="secondary" onClick={() => (window.location.href = "/")}>
                Upload Excel-fil
              </Button>
            </div>
          ) : (
            <>
              <TourList />
              {days.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <Button
                    onClick={() => recalcAllKm()}
                    disabled={isOptimizing}
                    className="w-full"
                  >
                    Beregn km
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────

type RawMusician = { bandName: string; productionName: string; firstName: string; lastName: string; address: string; postalCode: string; city: string };

async function geocodeMatchedMusicians(
  bandName: string,
  productionName: string,
  days: TourDay[],
  setMusicians: (m: Musician[]) => void,
  setMusicianLegDistances: (m: Map<string, number>) => void,
) {
  let raw: RawMusician[] = [];
  try {
    const stored = sessionStorage.getItem("lms_musicians_raw");
    if (!stored) return;
    raw = JSON.parse(stored) as RawMusician[];
  } catch { return; }

  const matched = raw.filter(
    (m) => m.bandName === bandName && m.productionName === productionName,
  );
  if (matched.length === 0) return;

  // Geocodes direkte fra browseren — persondata (navn, adresse) forlader aldrig LMS's server.
  // Nominatim usage policy: max 1 req/s pr. IP — derfor sekventielle kald med delay.
  const musicians: Musician[] = [];
  for (let i = 0; i < matched.length; i++) {
    if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, 1100));
    const m = matched[i];
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const cleanedAddress = m.address.split(",")[0].trim();
      const params = new URLSearchParams({
        street: cleanedAddress,
        postalcode: m.postalCode,
        city: m.city,
        country: "dk",
        format: "json",
        limit: "1",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "LMS-Turneplanner/1.0 (kenneth@lms.dk)" },
      });
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (Array.isArray(data) && data.length > 0) {
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
      }
    } catch { /* ingen koordinater */ }
    musicians.push({ ...m, id: crypto.randomUUID(), lat, lng });
  }
  setMusicians(musicians);

  // Beregn vejafstande hjem → første stop pr. dag via OSRM
  const distances = await fetchMusicianRoadDistances(musicians, days);
  setMusicianLegDistances(distances);
}

async function fetchMusicianRoadDistances(
  musicians: Musician[],
  days: TourDay[],
): Promise<Map<string, number>> {
  type Leg = { key: string; from: { lat: number; lng: number }; to: { lat: number; lng: number } };
  const legs: Leg[] = [];

  for (const m of musicians) {
    if (m.lat === null || m.lng === null) continue;
    for (let i = 0; i < days.length; i++) {
      const firstStop = days[i].schools.find((s) => s.lat !== null && s.lng !== null);
      if (!firstStop) continue;
      legs.push({
        key: `${m.id}_${i}`,
        from: { lat: m.lat, lng: m.lng },
        to: { lat: firstStop.lat!, lng: firstStop.lng! },
      });
    }
  }

  if (legs.length === 0) return new Map();

  try {
    const res = await fetch("/api/hotel-km", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legs: legs.map((l) => ({ from: l.from, to: l.to })) }),
    });
    if (!res.ok) return new Map();
    const data = await res.json() as { distances: number[] };
    const map = new Map<string, number>();
    legs.forEach((leg, i) => map.set(leg.key, data.distances[i]));
    return map;
  } catch {
    return new Map();
  }
}
