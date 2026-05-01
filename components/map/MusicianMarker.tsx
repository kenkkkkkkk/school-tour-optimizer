"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Musician } from "@/types/musician";

type Props = {
  musician: Musician;
};

export function MusicianMarker({ musician }: Props) {
  const map = useMap();

  useEffect(() => {
    if (musician.lat === null || musician.lng === null) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");

    const icon = L.divIcon({
      className: "",
      html: '<span style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🏠</span>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });

    const marker = L.marker([musician.lat, musician.lng], { icon }).addTo(map).bindTooltip(
      `<div style="line-height:1.5">
        <div style="font-weight:700">${musician.firstName} ${musician.lastName}</div>
        <div style="font-size:11px;color:#6b7280">${musician.address}, ${musician.postalCode} ${musician.city}</div>
      </div>`,
      { direction: "top", offset: [0, -22] },
    );

    return () => {
      marker.remove();
    };
  }, [map, musician]);

  return null;
}
