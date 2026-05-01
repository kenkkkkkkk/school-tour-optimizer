"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { GeoCoords } from "@/types/concert";

type Props = {
  /** Koordinater i rækkefølge — tegnes som stiplet linje */
  points: GeoCoords[];
  color: string;
};

export function RoutePolyline({ points, color }: Props) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");

    const latLngs = points.map((p) => L.latLng(p.lat, p.lng));
    const line = L.polyline(latLngs, {
      color,
      weight: 2,
      opacity: 0.75,
      dashArray: "6 6",
    }).addTo(map);

    return () => {
      line.remove();
    };
  }, [map, points, color]);

  return null;
}
