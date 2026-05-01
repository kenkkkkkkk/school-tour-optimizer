"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Hotel } from "@/types/hotel";

type Props = {
  hotel: Hotel;
  isSuggested: boolean;
  isSelected: boolean;
  onClick: (hotelId: string) => void;
};

export function HotelMarker({ hotel, isSuggested, isSelected, onClick }: Props) {
  const map = useMap();

  useEffect(() => {
    if (hotel.lat === null || hotel.lng === null) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");

    const bg = isSelected
      ? "#16a34a" // grøn
      : isSuggested
        ? "#ca8a04" // gul
        : hotel.hasAgreement
          ? "#7c3aed" // lilla (LMS-aftale)
          : "#3b82f6"; // blå (standard)

    const border = "white";
    const opacity = 1;
    const size = isSelected || isSuggested ? 30 : hotel.hasAgreement ? 26 : 20;

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:${size}px;height:${size}px;
        border-radius:4px;
        background:${bg};
        border:2px solid ${border};
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:12px;font-weight:700;
        opacity:${opacity};
        cursor:pointer;
      ">H</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const agreementBadge = hotel.hasAgreement
      ? `<span style="color:#16a34a;font-weight:700">✅ LMS-aftale</span>`
      : `<span style="color:#6b7280">Ingen LMS-aftale</span>`;

    const priceRow = hotel.singleRoomPrice != null
      ? `<div>Enkeltværelse: <strong>${hotel.singleRoomPrice} kr/nat</strong></div>`
      : "";

    const checkinRow = hotel.checkinAfter
      ? `<div style="color:#6b7280;font-size:11px">Check-in efter ${hotel.checkinAfter}${hotel.checkoutBefore ? ` · Check-out før ${hotel.checkoutBefore}` : ""}</div>`
      : "";

    const breakfastRow = hotel.breakfastIncluded
      ? `<div style="font-size:11px">🍳 Morgenmad inkluderet</div>`
      : "";

    const popupHtml = `<div style="min-width:180px;line-height:1.5">
      <div style="font-weight:700;margin-bottom:4px">${hotel.name}</div>
      <div style="font-size:11px;color:#6b7280">${hotel.address}, ${hotel.postalCode ?? ""} ${hotel.city}</div>
      <hr style="margin:6px 0;border-color:#e5e7eb">
      ${agreementBadge}
      ${priceRow}
      ${checkinRow}
      ${breakfastRow}
    </div>`;

    const marker = L.marker([hotel.lat, hotel.lng], { icon })
      .addTo(map)
      .bindTooltip(popupHtml, { direction: "top", offset: [0, -size / 2] })
      .on("click", () => onClick(hotel.id));

    return () => {
      marker.remove();
    };
  }, [map, hotel, isSuggested, isSelected, onClick]);

  return null;
}
