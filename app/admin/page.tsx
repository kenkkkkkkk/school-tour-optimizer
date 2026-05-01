"use client";

import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

// ─── Hotel import ──────────────────────────────────────────────────────────────

type HotelRow = { id: string; name: string; address: string; postal_code: string; city: string };

type HotelImportResult = {
  imported: number;
  excluded: number;
  geocoded: number;
  failed: number;
};

function HotelImporter() {
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [result, setResult] = useState<HotelImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setGeocodeProgress(null);
    setIsImporting(true);

    let needsGeocode: HotelRow[] = [];
    let importedCount = 0;
    let excludedCount = 0;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/import-hotels", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import fejlede");
      importedCount = data.imported;
      excludedCount = data.excluded;
      needsGeocode = data.needsGeocode ?? [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
      setIsImporting(false);
      return;
    } finally {
      setIsImporting(false);
    }

    // Fase 2: geocode hvert hotel
    setIsGeocoding(true);
    let geocoded = 0;
    let failed = 0;
    setGeocodeProgress({ done: 0, total: needsGeocode.length, failed: 0 });

    for (const hotel of needsGeocode) {
      try {
        const res = await fetch("/api/admin/geocode-hotel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: hotel.id,
            address: hotel.address,
            postalCode: hotel.postal_code,
            city: hotel.city,
          }),
        });
        const data = await res.json();
        if (data.ok) geocoded++;
        else failed++;
      } catch {
        failed++;
      }
      setGeocodeProgress({ done: geocoded + failed, total: needsGeocode.length, failed });
    }

    setIsGeocoding(false);
    setResult({ imported: importedCount, excluded: excludedCount, geocoded, failed });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  const busy = isImporting || isGeocoding;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold">Hotelliste</h2>
      <p className="mb-4 text-sm text-gray-500">
        Upload en opdateret hotelliste (.xlsx). Eksisterende hoteller opdateres; nye tilføjes.
        Koordinater genberegnes automatisk efter upload (~1 sek/hotel).
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`mb-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        <p className="mb-3 text-sm text-gray-500">Træk Excel-fil hertil, eller klik for at vælge</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} className="hidden" />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {isImporting ? <><Spinner className="mr-2" />Importerer…</> : "Vælg fil"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-900">
          <strong>Fejl:</strong> {error}
        </div>
      )}

      {isGeocoding && geocodeProgress && (
        <div className="mb-4 rounded-md bg-blue-50 p-4">
          <p className="mb-2 text-sm font-medium text-blue-900">
            Geocoder hoteller… ({geocodeProgress.done}/{geocodeProgress.total}
            {geocodeProgress.failed > 0 && `, ${geocodeProgress.failed} fejlede`})
          </p>
          <div className="h-2 w-full rounded-full bg-blue-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${(geocodeProgress.done / geocodeProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Import fuldført</p>
          <ul className="mt-1 space-y-0.5">
            <li>Importeret: {result.imported}</li>
            <li>Ekskluderet (LUKKET/BENYTTES IKKE): {result.excluded}</li>
            <li>Geocodet: {result.geocoded}</li>
            {result.failed > 0 && <li className="text-amber-700">Geocoding fejlede: {result.failed} (manglende/ugyldig adresse)</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Dataadministration</h1>
        <p className="mt-1 text-gray-600">Opdater hoteldata.</p>
        <a href="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          ← Tilbage til turnéplanlægger
        </a>
      </header>

      <div className="flex flex-col gap-6">
        <HotelImporter />
      </div>
    </main>
  );
}
