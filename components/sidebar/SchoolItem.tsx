"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ConcertStop, ConcertType } from "@/types/concert";
import { CONCERT_TYPE_LABELS } from "@/types/concert";

const TYPE_COLORS: Record<ConcertType, string> = {
  SPI: "bg-orange-100 text-orange-800",
  EFT: "bg-purple-100 text-purple-800",
  LØS: "bg-teal-100 text-teal-800",
  KUP: "bg-green-100 text-green-800",
  PRØ: "bg-yellow-100 text-yellow-800",
  FES: "bg-pink-100 text-pink-800",
};

type Props = {
  stop: ConcertStop;
  globalOrder: number;
  color: string;
  viewMode: "route" | "hotels";
  onToggleLock: () => void;
};

export function SchoolItem({ stop, globalOrder, color, viewMode, onToggleLock }: Props) {
  const locked = stop.locked ?? false;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${stop.schoolName}__${stop.concertDate.toISOString()}__${stop.tourOrder}`, disabled: locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Nummereret farve-dot (grå "?" for placeholder) — vises i begge modes
  const numberedDot = stop.isPlaceholder ? (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-bold text-white">
      ?
    </span>
  ) : (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {globalOrder + 1}
    </span>
  );

  // Lås-knap — forhindrer drag når aktiv
  const lockButton = (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
      className={`flex shrink-0 items-center ${locked ? "text-blue-500 hover:text-blue-700" : "text-gray-300 hover:text-gray-500"}`}
      aria-label={locked ? "Lås op" : "Lås placering"}
      title={locked ? "Lås op" : "Lås placering"}
    >
      {locked ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 14H6V10h12v10zm-6-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-0 group-hover:opacity-100">
          <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 14H6V10h12v10zm-6-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        </svg>
      )}
    </button>
  );

  // Drag-håndtag — deaktiveret når stop er låst
  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      className={`flex touch-none text-gray-400 ${locked ? "cursor-not-allowed opacity-25 pointer-events-none" : "cursor-grab active:cursor-grabbing"}`}
      aria-label="Flyt skole"
      tabIndex={locked ? -1 : 0}
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
        <circle cx="4" cy="3" r="1.5" />
        <circle cx="8" cy="3" r="1.5" />
        <circle cx="4" cy="8" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="4" cy="13" r="1.5" />
        <circle cx="8" cy="13" r="1.5" />
      </svg>
    </button>
  );

  // Hotels-mode: drag-håndtag + nummereret cirkel + skolenavn
  if (viewMode === "hotels") {
    return (
      <div ref={setNodeRef} style={style} className="group flex items-center gap-2 px-2 py-1">
        {lockButton}
        {dragHandle}
        {numberedDot}
        <span className={`text-sm ${stop.isPlaceholder ? "italic text-gray-400" : "text-gray-700"}`}>
          {stop.schoolName}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
    >
      {lockButton}
      {dragHandle}

      {numberedDot}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <div className={`shrink-0 text-sm font-medium ${stop.isPlaceholder ? "italic text-gray-400" : ""}`}>
            {stop.schoolName}
          </div>
          {stop.projectWeeks && (
            <span
              className="min-w-0 truncate text-xs text-amber-700"
              title={`Projektuger: ${stop.projectWeeks}`}
            >
              Projektuger: {stop.projectWeeks}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-gray-500">
          {stop.concertTime}
          {stop.isEveningConcert && " ⭐"}
        </div>
        {stop.notes && (
          <div className="truncate text-xs italic text-amber-700">{stop.notes}</div>
        )}
        {stop.isPlaceholder && (
          <div className="mt-0.5">
            <span className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-500">Placering ukendt</span>
          </div>
        )}
        {stop.concertTypes.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {stop.concertTypes.map((t) => (
              <span
                key={t}
                title={CONCERT_TYPE_LABELS[t]}
                className={`rounded px-1 py-0.5 text-xs font-semibold ${TYPE_COLORS[t]}`}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
