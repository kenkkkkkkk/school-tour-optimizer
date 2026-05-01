"use client";

import { useState, useRef, useEffect } from "react";
import { useTourStore } from "@/lib/store/tourStore";
import { downloadExcel, downloadPdf } from "@/lib/export/tourExport";

type LoadingState = "excel" | "pdf" | null;

export function DownloadMenu() {
  const days = useTourStore((s) => s.days);
  const bandName = useTourStore((s) => s.bandName);
  const allHotels = useTourStore((s) => s.allHotels);
  const preTourNight = useTourStore((s) => s.preTourNight);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<LoadingState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (days.length === 0) return null;

  async function handle(type: "excel" | "pdf") {
    setLoading(type);
    try {
      if (type === "excel") await downloadExcel(days, bandName, allHotels, preTourNight);
      else await downloadPdf(days, bandName, allHotels, preTourNight);
    } finally {
      setLoading(null);
      setOpen(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading !== null}
        className="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
      >
        {loading ? "…" : "Download ▾"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={loading !== null}
            onClick={() => handle("excel")}
          >
            Excel (.xlsx)
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={loading !== null}
            onClick={() => handle("pdf")}
          >
            PDF (.pdf)
          </button>
        </div>
      )}
    </div>
  );
}
