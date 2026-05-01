"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { SchoolMarker } from "./SchoolMarker";
import { HotelMarker } from "./HotelMarker";
import { MusicianMarker } from "./MusicianMarker";
import { RoutePolyline } from "./RoutePolyline";
import { useTourStore, dayHexColor } from "@/lib/store/tourStore";
import type { GeoCoords } from "@/types/concert";

/** Center-punkt over Danmark — standard startudsigt */
const DENMARK_CENTER: [number, number] = [56.2639, 9.5018];

export function TourMap() {
  const days = useTourStore((s) => s.days);
  const allHotels = useTourStore((s) => s.allHotels);
  const hoveredDayIndex = useTourStore((s) => s.hoveredDayIndex);
  const selectedDayIndex = useTourStore((s) => s.selectedDayIndex);
  const selectHotel = useTourStore((s) => s.selectHotel);
  const preTourNight = useTourStore((s) => s.preTourNight);
  const selectPreTourHotel = useTourStore((s) => s.selectPreTourHotel);
  const musicians = useTourStore((s) => s.musicians);
  const showMusicians = useTourStore((s) => s.showMusicians);
  const toggleShowMusicians = useTourStore((s) => s.toggleShowMusicians);

  const failedMusicians = useMemo(
    () => musicians.filter((m) => m.lat === null || m.lng === null),
    [musicians],
  );

  // Nulstil advarsel når der hentes en ny musikerliste (nyt band/produktion)
  const [warningDismissed, setWarningDismissed] = useState(false);
  useEffect(() => {
    setWarningDismissed(false);
  }, [musicians]);

  // Klik på dag i sidebar → vis hoteller nær NÆSTE dags koncerter.
  // selectedDayIndex === -1 = overnatning aftenen FØR første turnédag.
  // Alle aktive hoteller vises — ingen område-filtrering.
  const visibleHotels = useMemo(() => {
    if (selectedDayIndex === null) return [];
    if (allHotels.length === 0) return [];
    if (selectedDayIndex === -1) return preTourNight.requiresHotel ? allHotels : [];
    return days[selectedDayIndex]?.requiresHotel ? allHotels : [];
  }, [selectedDayIndex, days, allHotels, preTourNight.requiresHotel]);

  // Det valgte hotel for den klikkede nat
  const activeSelectedHotelId = useMemo(() => {
    if (selectedDayIndex === -1) return preTourNight.selectedHotelId;
    if (selectedDayIndex !== null) return days[selectedDayIndex]?.selectedHotelId ?? null;
    return null;
  }, [selectedDayIndex, days, preTourNight]);

  // Det foreslåede hotel for den klikkede nat
  const activeSuggestedHotelId = useMemo(() => {
    if (selectedDayIndex === -1) return preTourNight.suggestedHotelId;
    if (selectedDayIndex !== null) return days[selectedDayIndex]?.suggestedHotelId ?? null;
    return null;
  }, [selectedDayIndex, days, preTourNight]);

  const handleHotelClick = useCallback(
    (hotelId: string) => {
      if (selectedDayIndex === -1) {
        selectPreTourHotel(hotelId);
      } else if (selectedDayIndex !== null) {
        selectHotel(selectedDayIndex, hotelId);
      }
    },
    [selectedDayIndex, selectHotel, selectPreTourHotel],
  );

  // Rute-linje punkter: flat liste over alle skoler i rækkefølge
  const routePointsByDay = useMemo<{ points: GeoCoords[]; color: string }[]>(
    () =>
      days.map((day, i) => ({
        color: dayHexColor(i),
        points: day.schools
          .filter((s) => s.lat !== null && s.lng !== null)
          .map((s) => ({ lat: s.lat!, lng: s.lng! })),
      })),
    [days],
  );

  // Global rækkefølgenummer pr. stop (summeret på tværs af dage)
  const globalOrderByStop = useMemo(() => {
    const map = new Map<number, number>();
    let order = 0;
    for (const day of days) {
      for (const school of day.schools) {
        map.set(school.tourOrder, order++);
      }
    }
    return map;
  }, [days]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DENMARK_CENTER}
        zoom={7}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Rute-linjer pr. dag */}
        {routePointsByDay.map((r, i) => (
          <RoutePolyline key={i} points={r.points} color={r.color} />
        ))}

        {/* Skole-markører */}
        {days.map((day, dayIdx) =>
          day.schools.map((stop) => (
            <SchoolMarker
              key={stop.tourOrder}
              stop={stop}
              globalOrder={globalOrderByStop.get(stop.tourOrder) ?? 0}
              color={dayHexColor(dayIdx)}
              isHighlighted={hoveredDayIndex === dayIdx}
            />
          )),
        )}

        {/* Hotel-markører — vises kun når en dag er valgt og natten inden kræver hotel */}
        {visibleHotels.map((hotel) => (
          <HotelMarker
            key={hotel.id}
            hotel={hotel}
            isSuggested={hotel.id === activeSuggestedHotelId}
            isSelected={hotel.id === activeSelectedHotelId}
            onClick={handleHotelClick}
          />
        ))}

        {/* Musiker-markører */}
        {showMusicians &&
          musicians.map((m) => <MusicianMarker key={m.id} musician={m} />)}
      </MapContainer>

      {/* Musiker-overlay (toggle + advarsel) — øverst til højre */}
      {musicians.length > 0 && (
        <div className="absolute right-3 top-3 z-[1000] flex max-w-xs flex-col items-end gap-2">
          <button
            onClick={toggleShowMusicians}
            className={`rounded px-2 py-1 text-xs font-medium shadow-md transition-colors ${
              showMusicians
                ? "bg-white text-gray-800 hover:bg-gray-50"
                : "bg-gray-200 text-gray-500 hover:bg-gray-300"
            }`}
            title="Vis/skjul musikermarkører"
          >
            🏠 Musikere
          </button>

          {failedMusicians.length > 0 && !warningDismissed && (
            <div className="w-full rounded-md border border-amber-300 bg-amber-50 p-3 shadow-md">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-amber-900">
                  ⚠️ {failedMusicians.length} musiker
                  {failedMusicians.length === 1 ? "" : "e"} kunne ikke vises på
                  kortet
                </p>
                <button
                  onClick={() => setWarningDismissed(true)}
                  className="-mt-0.5 -mr-0.5 px-1 text-base leading-none text-amber-700 hover:text-amber-900"
                  aria-label="Luk advarsel"
                >
                  ×
                </button>
              </div>
              <p className="mb-1 text-[11px] text-amber-800">
                Mangler eller ugyldig adresse i kildedata:
              </p>
              <ul className="space-y-0.5 text-xs text-amber-900">
                {failedMusicians.map((m) => (
                  <li key={m.id}>
                    {m.firstName} {m.lastName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
