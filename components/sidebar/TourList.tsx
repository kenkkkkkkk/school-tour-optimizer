"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";

// Når en hel dag trækkes, må kollisionsdetektionen KUN matche mod
// andre dag-containere (day__*). Uden dette finder closestCenter de
// indlejrede skole-elementer først, og droppet slår fejl.
const tourCollisionDetection: CollisionDetection = (args) => {
  if (String(args.active.id).startsWith("day__")) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        String(c.id).startsWith("day__"),
      ),
    });
  }
  return closestCenter(args);
};
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTourStore, dayHexColor } from "@/lib/store/tourStore";
import type { ConcertStop, TourDay } from "@/types/concert";
import { CONCERT_TYPE_LABELS } from "@/types/concert";
import { dateOnlyISO } from "@/lib/excel/excelDate";
import { DayGroup, formatDayHeader } from "./DayGroup";

export function TourList() {
  const days = useTourStore((s) => s.days);
  const allHotels = useTourStore((s) => s.allHotels);
  const reorderWithinDay = useTourStore((s) => s.reorderWithinDay);
  const moveBetweenDays = useTourStore((s) => s.moveBetweenDays);
  const reorderDays = useTourStore((s) => s.reorderDays);
  const setHoveredDay = useTourStore((s) => s.setHoveredDay);
  const selectedDayIndex = useTourStore((s) => s.selectedDayIndex);
  const setSelectedDay = useTourStore((s) => s.setSelectedDay);
  const toggleHotelRequired = useTourStore((s) => s.toggleHotelRequired);
  const toggleLockStop = useTourStore((s) => s.toggleLockStop);
  const toggleLockDay = useTourStore((s) => s.toggleLockDay);

  const preTourNight = useTourStore((s) => s.preTourNight);
  const togglePreTourHotel = useTourStore((s) => s.togglePreTourHotel);
  const suppressWarnings = useTourStore((s) => s.suppressWarnings);
  const viewMode = useTourStore((s) => s.viewMode);
  const setViewMode = useTourStore((s) => s.setViewMode);
  const musicians = useTourStore((s) => s.musicians);

  const [activeDragStop, setActiveDragStop] = useState<ConcertStop | null>(null);
  const [activeDragDay, setActiveDragDay] = useState<TourDay | null>(null);
  const [overDayId, setOverDayId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragOver(event: DragOverEvent) {
    setOverDayId(event.over ? String(event.over.id) : null);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);

    if (id.startsWith("day__")) {
      const dateKey = id.slice(5);
      setActiveDragDay(days.find((d) => dateOnlyISO(d.date) === dateKey) ?? null);
      return;
    }

    for (const day of days) {
      const stop = day.schools.find(
        (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}` === id,
      );
      if (stop) {
        setActiveDragStop(stop);
        break;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragStop(null);
    setActiveDragDay(null);
    setOverDayId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Dag-reordering
    if (activeId.startsWith("day__")) {
      if (!overId.startsWith("day__")) return;
      const fromIdx = days.findIndex((d) => dateOnlyISO(d.date) === activeId.slice(5));
      const toIdx = days.findIndex((d) => dateOnlyISO(d.date) === overId.slice(5));
      if (fromIdx < 0 || toIdx < 0) return;

      const lo = Math.min(fromIdx, toIdx);
      const hi = Math.max(fromIdx, toIdx);
      const specialSchools = days
        .slice(lo, hi + 1)
        .flatMap((d) => d.schools)
        .filter((s) => s.concertTypes.length > 0 && !s.isPlaceholder);
      if (!suppressWarnings && specialSchools.length > 0) {
        const typeNames = [...new Set(specialSchools.flatMap((s) => s.concertTypes))]
          .map((t) => CONCERT_TYPE_LABELS[t])
          .join(", ");
        const ok = window.confirm(
          `Denne flytning påvirker ${specialSchools.length} koncert(er) markeret som ${typeNames} — herunder på dage du ikke selv trækker.\n\nEr du sikker?`,
        );
        if (!ok) return;
      }

      // Blokér kun hvis den dag der TRÆKKES selv har låste koncerter
      if (days[fromIdx].schools.some((s) => s.locked)) return;

      reorderDays(fromIdx, toIdx);
      return;
    }

    // Skole-reordering/flytning
    const fromDayIndex = days.findIndex((d) =>
      d.schools.some(
        (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}` === activeId,
      ),
    );
    if (fromDayIndex < 0) return;
    const fromIdx = days[fromDayIndex].schools.findIndex(
      (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}` === activeId,
    );
    if (days[fromDayIndex].schools[fromIdx]?.locked) return;

    const droppedOnDayZone = overId.startsWith("day-drop-");
    const toDayIndex = droppedOnDayZone
      ? Number(overId.replace("day-drop-", ""))
      : days.findIndex((d) =>
          d.schools.some(
            (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}` === overId,
          ),
        );

    if (toDayIndex < 0) return;

    if (fromDayIndex === toDayIndex) {
      const toIdx = days[toDayIndex].schools.findIndex(
        (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}` === overId,
      );
      if (toIdx >= 0) reorderWithinDay(fromDayIndex, fromIdx, toIdx);
    } else {
      const toIdx = droppedOnDayZone
        ? days[toDayIndex].schools.length
        : days[toDayIndex].schools.findIndex(
            (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}` === overId,
          );

      // Advar planlæggeren hvis koncerten har en særlig type
      if (!suppressWarnings && activeDragStop && activeDragStop.concertTypes.length > 0 && !activeDragStop.isPlaceholder) {
        const labels = activeDragStop.concertTypes
          .map((t) => CONCERT_TYPE_LABELS[t])
          .join(", ");
        const ok = window.confirm(
          `"${activeDragStop.schoolName}" er markeret som ${labels}.\n\nEr du sikker på, at du vil flytte den til en anden dag?`,
        );
        if (!ok) return;
      }

      moveBetweenDays(fromDayIndex, fromIdx, toDayIndex, toIdx >= 0 ? toIdx : 0);
    }
  }

  // Beregn global start-orden pr. dag (antal skoler i alle tidligere dage)
  const globalStartOrders = days.reduce<number[]>((acc, _day, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + days[i - 1].schools.length);
    return acc;
  }, []);

  const dayIds = days.map((d) => `day__${dateOnlyISO(d.date)}`);

  // Løbende km-sum fra turnéstart frem til afslutningen af hver dag
  const cumulativeKm = days.reduce<number[]>((acc, day, i) => {
    const prev = i === 0 ? 0 : acc[i - 1];
    acc.push(Math.round((prev + day.kmThisDay) * 10) / 10);
    return acc;
  }, []);

  // Beregn hvilke dage der får ny dato, hvis man dropper her.
  // Spejler reorderDays-algoritmen: låste dage er fastpunkter, øvrige fordeler resterende datoer.
  // Nøgle = originalDayIndex → ny dato.
  const datePreviewMap = useMemo((): Map<number, Date> => {
    if (!activeDragDay || !overDayId?.startsWith("day__")) return new Map();
    const fromIdx = days.findIndex((d) => d === activeDragDay);
    const toIdx = days.findIndex((d) => dateOnlyISO(d.date) === overDayId.slice(5));
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return new Map();
    if (activeDragDay.schools.some((s) => s.locked)) return new Map();
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    // Simulér splice-operationen (samme som reorderDays i store)
    const sim = [...days];
    const [moved] = sim.splice(fromIdx, 1);
    sim.splice(toIdx, 0, moved);
    // Find låste datoer i den simulerede range
    const lockedTimes = new Set<number>();
    for (let i = lo; i <= hi; i++) {
      if (sim[i].schools.some((s) => s.locked)) lockedTimes.add(sim[i].date.getTime());
    }
    // Tilgængelig dato-pulje: originale datoer i range minus låste
    const available = days.slice(lo, hi + 1).map((d) => d.date)
      .filter((d) => !lockedTimes.has(d.getTime()));
    // Byg map fra originalDayIndex → ny dato
    const result = new Map<number, Date>();
    let ai = 0;
    for (let i = lo; i <= hi; i++) {
      if (!sim[i].schools.some((s) => s.locked)) {
        const newDate = available[ai++];
        const origIdx = days.indexOf(sim[i]);
        if (origIdx >= 0 && newDate.getTime() !== sim[i].date.getTime()) {
          result.set(origIdx, newDate);
        }
      }
    }
    return result;
  }, [activeDragDay, overDayId, days]);

  // Ved enkelt-koncert-træk: hvilken dato ville koncerten få ved drop her?
  const concertPreviewDate = useMemo((): Date | null => {
    if (!activeDragStop || !overDayId) return null;
    let targetDay: TourDay | undefined;
    if (overDayId.startsWith("day-drop-")) {
      targetDay = days[Number(overDayId.replace("day-drop-", ""))];
    } else if (overDayId.startsWith("day__")) {
      targetDay = days.find((d) => dateOnlyISO(d.date) === overDayId.slice(5));
    } else {
      targetDay = days.find((d) =>
        d.schools.some(
          (s) => `${s.schoolName}__${s.concertDate.toISOString()}__${s.tourOrder}` === overDayId,
        ),
      );
    }
    if (!targetDay) return null;
    if (dateOnlyISO(targetDay.date) === dateOnlyISO(activeDragStop.concertDate)) return null;
    return targetDay.date;
  }, [activeDragStop, overDayId, days]);

  if (days.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-400">
        Upload en Excel-fil og klik Optimér for at se turnéplanen
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={tourCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-y-auto px-2 py-3">
        {/* View-mode toggle: Rute / Overnatning */}
        <div className="mb-3 flex rounded-md bg-gray-100 p-0.5">
          <button
            onClick={() => setViewMode("route")}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "route"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Rute
          </button>
          <button
            onClick={() => setViewMode("hotels")}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "hotels"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Overnatning
          </button>
        </div>

        {/* Overnatning aftenen FØR første turnédag — kun i hotels-mode */}
        {viewMode === "hotels" && (
          <div className="mb-3 px-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  togglePreTourHotel();
                  if (!preTourNight.requiresHotel) setSelectedDay(-1);
                }}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  preTourNight.requiresHotel
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                title={preTourNight.requiresHotel ? "Fjern overnatning aftenen før" : "Tilføj overnatning aftenen før"}
              >
                🏨 {preTourNight.requiresHotel ? "Overnatning aftenen før" : "Ingen overnatning aftenen før"}
              </button>
              {preTourNight.requiresHotel && (
                <button
                  onClick={() => setSelectedDay(selectedDayIndex === -1 ? null : -1)}
                  className={`rounded px-1 py-1 text-xs transition-colors ${
                    selectedDayIndex === -1 ? "bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-300" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {(() => {
                    const hotelId = preTourNight.selectedHotelId ?? preTourNight.suggestedHotelId;
                    const hotel = hotelId ? allHotels.find((h) => h.id === hotelId) : null;
                    return hotel ? hotel.name : "Klik på dag for at vise/skjule hoteller på kort";
                  })()}
                </button>
              )}
            </div>
          </div>
        )}

        <SortableContext items={dayIds} strategy={verticalListSortingStrategy}>
          {days.map((day, dayIndex) => {
            const activeHotelId = day.selectedHotelId ?? day.suggestedHotelId;
            const hotel = activeHotelId
              ? allHotels.find((h) => h.id === activeHotelId)
              : undefined;

            return (
              <DayGroup
                key={day.date.toISOString()}
                day={day}
                dayIndex={dayIndex}
                globalStartOrder={globalStartOrders[dayIndex]}
                isLastDay={dayIndex === days.length - 1}
                hotelName={hotel?.name}
                isSelected={selectedDayIndex === dayIndex}
                kmTotal={cumulativeKm[dayIndex]}
                viewMode={viewMode}
                musicians={musicians}
                previewDate={datePreviewMap.get(dayIndex) ?? null}
                onToggleLock={(tourOrder) => toggleLockStop(dayIndex, tourOrder)}
                onToggleDayLock={() => toggleLockDay(dayIndex)}
                onDayClick={() =>
                  setSelectedDay(selectedDayIndex === dayIndex ? null : dayIndex)
                }
                onToggleHotel={() => toggleHotelRequired(dayIndex)}
                onMouseEnter={() => setHoveredDay(dayIndex)}
                onMouseLeave={() => setHoveredDay(null)}
              />
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeDragDay && (() => {
          const fromIdx = days.findIndex((d) => d === activeDragDay);
          const newDate = datePreviewMap.get(fromIdx) ?? null;
          return (
            <div className="rotate-1 scale-105 rounded-md border-2 border-indigo-300 bg-white px-3 py-2.5 opacity-95 shadow-xl">
              <div
                className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: dayHexColor(fromIdx) }}
              >
                <span className={newDate ? "opacity-40 line-through" : ""}>
                  {formatDayHeader(activeDragDay.date)}
                </span>
                {newDate && (
                  <span className="ml-1.5 text-indigo-500 no-underline">
                    → {formatDayHeader(newDate).split(" · ")[1]}
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {activeDragDay.schools.map((s, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-xs">
                    <span className="shrink-0 text-gray-400">{s.concertTime}</span>
                    <span className="font-medium text-gray-800">{s.schoolName}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
        {activeDragStop && (
          <div className="rotate-1 scale-105 rounded-md border border-blue-300 bg-white px-2 py-1.5 opacity-95 shadow-lg">
            <div className="text-sm font-medium">{activeDragStop.schoolName}</div>
            <div className="text-xs text-gray-500">
              {activeDragStop.concertTime} · {activeDragStop.city}
            </div>
            {concertPreviewDate && (
              <div className="mt-1 flex items-center gap-1 border-t border-gray-100 pt-1 text-xs">
                <span className="text-gray-400">→</span>
                <span className="font-semibold text-blue-600">
                  {formatDayHeader(concertPreviewDate).split(" · ")[1]}
                </span>
              </div>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
