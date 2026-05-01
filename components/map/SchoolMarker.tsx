"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Marker } from "leaflet";
import type { ConcertStop } from "@/types/concert";

type Props = {
  stop: ConcertStop;
  globalOrder: number;
  color: string;
  isHighlighted: boolean;
};

export function SchoolMarker({ stop, globalOrder, color, isHighlighted }: Props) {
  const map = useMap();
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    // Leaflet importeres dynamisk fordi det bruger `window`
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");

    if (!stop.lat || !stop.lng) return;

    const size = isHighlighted ? 32 : 28;
    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${color};
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:${size > 28 ? 13 : 11}px;font-weight:700;
        transition:all 0.15s;
      ">${globalOrder + 1}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const marker = L.marker([stop.lat, stop.lng], { icon })
      .addTo(map)
      .bindTooltip(
        `<strong>${stop.schoolName}</strong><br>${stop.address}, ${stop.postalCode} ${stop.city}<br>${stop.concertTime}${stop.isEveningConcert ? " ⭐" : ""}`,
        { direction: "top", offset: [0, -size / 2] },
      );

    markerRef.current = marker;
    return () => {
      marker.remove();
    };
  }, [map, stop, globalOrder, color, isHighlighted]);

  return null;
}
