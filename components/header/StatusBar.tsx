"use client";

import { useTourStore } from "@/lib/store/tourStore";
import { Button } from "@/components/ui/Button";
import { DownloadMenu } from "@/components/header/DownloadMenu";
import Link from "next/link";

type Props = {
  onReoptimize?: () => void;
  isOptimizing?: boolean;
};

export function StatusBar({ onReoptimize, isOptimizing }: Props) {
  const bandName = useTourStore((s) => s.bandName);
  const totalKm = useTourStore((s) => s.totalKm);
  const days = useTourStore((s) => s.days);
  const history = useTourStore((s) => s.history);
  const undo = useTourStore((s) => s.undo);
  const suppressWarnings = useTourStore((s) => s.suppressWarnings);
  const toggleSuppressWarnings = useTourStore((s) => s.toggleSuppressWarnings);

  const totalConcerts = days.reduce((n, d) => n + d.schools.length, 0);
  const hotelNights = days.filter((d) => d.requiresHotel).length;

  return (
    <header className="flex h-12 items-center gap-4 border-b border-gray-200 bg-white px-4 shadow-sm">
      {/* Logo / navn */}
      <Link href="/" className="shrink-0 text-sm font-bold text-blue-700">
        LMS Turnéplanner
      </Link>

      {/* Turné-navn + advarsel-toggle */}
      {bandName && (
        <span className="hidden truncate text-sm text-gray-700 sm:block">
          {bandName}
        </span>
      )}
      <label className="flex shrink-0 cursor-pointer items-center gap-2 select-none">
        <span className="text-xs text-gray-500">Ignorér advarsler</span>
        <span className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={suppressWarnings}
            onChange={toggleSuppressWarnings}
          />
          <span className={`block h-5 w-9 rounded-full transition-colors ${suppressWarnings ? "bg-amber-400" : "bg-gray-200"}`} />
          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${suppressWarnings ? "translate-x-4" : "translate-x-0"}`} />
        </span>
      </label>

      <div className="flex-1" />

      {/* Statistik */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        {totalConcerts > 0 && (
          <>
            <span>
              <strong>{totalKm.toFixed(1)}</strong> km total
            </span>
            <span>
              <strong>{totalConcerts}</strong> koncerter
            </span>
            {hotelNights > 0 && (
              <span>
                🏨 <strong>{hotelNights}</strong> nætter
              </span>
            )}
          </>
        )}
      </div>

      {/* Handlinger */}
      <div className="flex items-center gap-2">
        {history.length > 0 && (
          <Button
            variant="ghost"
            onClick={undo}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Fortryd
          </Button>
        )}
        {onReoptimize && (
          <Button
            variant="ghost"
            onClick={onReoptimize}
            disabled={isOptimizing}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {isOptimizing ? "Optimerer…" : "Nulstil"}
          </Button>
        )}
        <DownloadMenu />
        <Link href="/">
          <Button variant="ghost" className="text-xs">
            Ny turné
          </Button>
        </Link>
      </div>
    </header>
  );
}
