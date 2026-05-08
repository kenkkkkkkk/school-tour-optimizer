"use client";

import { useMemo } from "react";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TourDay } from "@/types/concert";
import type { Musician } from "@/types/musician";
import { SchoolItem } from "./SchoolItem";
import { dayHexColor, useTourStore } from "@/lib/store/tourStore";
import { haversineMeters } from "@/lib/routing/distanceMatrix";
import { useDroppable } from "@dnd-kit/core";
import { dateOnlyISO } from "@/lib/excel/excelDate";

type Props = {
  day: TourDay;
  dayIndex: number;
  globalStartOrder: number;
  isLastDay: boolean;
  hotelName?: string;
  isSelected: boolean;
  kmTotal: number;
  viewMode: "route" | "hotels";
  musicians: Musician[];
  previewDate: Date | null;
  onToggleLock: (tourOrder: number) => void;
  onToggleDayLock: () => void;
  onDayClick: () => void;
  onToggleHotel: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isSwapTarget: boolean;
};

const WEEKDAYS_DA = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
const MONTHS_DA = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatDayHeader(date: Date): string {
  const week = getISOWeek(date);
  const weekday = WEEKDAYS_DA[date.getUTCDay()];
  const d = date.getUTCDate();
  const month = MONTHS_DA[date.getUTCMonth()];
  return `Uge ${week} · ${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${d}. ${month}`;
}

export function DayGroup({
  day,
  dayIndex,
  globalStartOrder,
  isLastDay,
  hotelName,
  isSelected,
  kmTotal,
  viewMode,
  musicians,
  previewDate,
  onToggleLock,
  onToggleDayLock,
  onDayClick,
  onToggleHotel,
  onMouseEnter,
  onMouseLeave,
  isSwapTarget,
}: Props) {
  const color = dayHexColor(dayIndex);
  const allLocked = day.schools.length > 0 && day.schools.every((s) => s.locked);
  const musicianLegDistances = useTourStore((s) => s.musicianLegDistances);

  const firstStop = day.schools.find((s) => s.lat !== null && s.lng !== null) ?? null;

  const musicianDistances = useMemo(() => {
    if (!firstStop || viewMode !== "hotels") return [];
    return musicians
      .map((m) => {
        let km: number | null = null;
        const roadMeters = musicianLegDistances.get(`${m.id}_${dayIndex}`);
        if (roadMeters !== undefined) {
          km = Math.round(roadMeters / 100) / 10;
        } else if (m.lat !== null && m.lng !== null) {
          km = Math.round(
            haversineMeters({ lat: m.lat, lng: m.lng }, { lat: firstStop.lat!, lng: firstStop.lng! }) / 100,
          ) / 10;
        }
        return { id: m.id, name: `${m.firstName} ${m.lastName}`, km };
      })
      .sort((a, b) => {
        if (a.km === null) return 1;
        if (b.km === null) return -1;
        return a.km - b.km;
      });
  }, [musicians, firstStop, viewMode, musicianLegDistances, dayIndex]);
  const sortableIds = day.schools.map(
    (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}`,
  );

  // Dag-niveau sortable — giver mulighed for at trække hele dagen
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  // disabled=false så dagen ALTID er registreret som drop-target i dnd-kit —
  // drag-initieringen styres i stedet via listeners på grip-knappen nedenfor.
  } = useSortable({ id: `day__${dateOnlyISO(day.date)}` });

  // Droppable zone for cross-day skole-drag
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `day-drop-${dayIndex}`,
  });

  const dayStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={dayStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="mb-3"
    >
      {/* Dag-header: grip-håndtag + dag-lås + hotel-klik */}
      <div className="flex items-center">
        <button
          {...attributes}
          {...listeners}
          className="flex shrink-0 cursor-grab touch-none px-1 py-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          aria-label="Flyt dag"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="0" y="0" width="10" height="1.5" rx="0.75" />
            <rect x="0" y="4" width="10" height="1.5" rx="0.75" />
            <rect x="0" y="8" width="10" height="1.5" rx="0.75" />
          </svg>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleDayLock(); }}
          className={`flex shrink-0 items-center px-1 py-1 ${allLocked ? "text-blue-500 hover:text-blue-700" : "text-gray-300 hover:text-gray-500"}`}
          title={allLocked ? "Lås dag op" : "Lås hele dagen"}
          aria-label={allLocked ? "Lås dag op" : "Lås hele dagen"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 14H6V10h12v10zm-6-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
          </svg>
        </button>

        <button
          onClick={viewMode === "hotels" ? onDayClick : undefined}
          disabled={viewMode === "route"}
          className={`flex flex-1 items-center justify-between rounded px-1 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
            isSelected ? "bg-blue-50 ring-1 ring-blue-300" : viewMode === "hotels" ? "hover:bg-gray-50" : ""
          } ${viewMode === "route" ? "cursor-default" : ""}`}
          style={{ color }}
          title={
            viewMode === "route"
              ? undefined
              : day.requiresHotel
                ? isSelected
                  ? "Klik for at lukke hotel-visning"
                  : "Klik for at se hoteller i næste dags område"
                : "Slå overnatning til for at vælge hotel"
          }
        >
          <span className="flex items-baseline gap-1.5">
            <span className="text-base">{formatDayHeader(day.date).split(" · ")[0]}</span>
            {" · "}
            <span className={previewDate ? "opacity-40 line-through" : ""}>
              {formatDayHeader(day.date).split(" · ")[1]}
            </span>
            {previewDate && (
              <span className="font-semibold text-indigo-500">
                → {formatDayHeader(previewDate).split(" · ")[1]}
              </span>
            )}
          </span>
          <span className="text-gray-500">{kmTotal.toFixed(1)} km{isSelected && " 🏨"}</span>
        </button>
      </div>

      {/* Sortable drop-zone for skoler */}
      <div
        ref={setDropRef}
        className={`rounded-lg border transition-colors ${
          isSwapTarget ? "border-orange-400 bg-orange-50 ring-2 ring-orange-300" :
          isOver ? "border-blue-300 bg-blue-50" : "border-transparent"
        }`}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {day.schools.map((stop, idx) => (
            <SchoolItem
              key={`${stop.schoolName}__${stop.concertDate.toISOString()}__${stop.tourOrder}`}
              stop={stop}
              globalOrder={globalStartOrder + idx}
              color={color}
              viewMode={viewMode}
              onToggleLock={() => onToggleLock(stop.tourOrder)}
            />
          ))}
          {day.schools.length === 0 && (
            <p className="px-2 py-2 text-xs italic text-gray-400">
              Ingen skoler — træk hertil
            </p>
          )}
        </SortableContext>
      </div>

      {/* Musiker-afstande til dagens første stop — vises i hotels-mode */}
      {viewMode === "hotels" && musicianDistances.length > 0 && (
        <div className="mx-2 mt-1.5 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Hjem → {firstStop?.schoolName ?? "første stop"}
          </p>
          <ul className="space-y-0.5">
            {musicianDistances.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{m.name}</span>
                <span className={m.km === null ? "italic text-gray-400" : "font-medium text-gray-900"}>
                  {m.km !== null ? `${m.km.toFixed(1)} km` : "Adresse mangler"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hotel-toggle (ikke på den sidste dag, og kun i hotels-mode) */}
      {!isLastDay && viewMode === "hotels" && (
        <div className="mx-2 mt-1 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleHotel();
              // Auto-vælg dagen første gang overnatning slås til
              if (!day.requiresHotel && !isSelected) onDayClick();
            }}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
              day.requiresHotel
                ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            title={day.requiresHotel ? "Klik for at fjerne overnatning" : "Klik for at tilføje overnatning"}
          >
            🏨 {day.requiresHotel ? "Overnatning" : "Ingen overnatning"}
          </button>
          {day.requiresHotel && (
            <span className="text-xs text-gray-400">
              {hotelName ? hotelName : "Klik på dag for at vise/skjule hoteller på kort"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
