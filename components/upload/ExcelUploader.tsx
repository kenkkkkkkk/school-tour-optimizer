"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { parseTourPlan } from "@/lib/excel/parseTourPlan";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

type ParsedStop = {
  schoolName: string;
  address: string;
  postalCode: string;
  city: string;
  area: string;
  concertDate: string;
  concertTime: string;
  isEveningConcert: boolean;
  notes: string;
  concertTypes: string[];
  isPlaceholder: boolean;
  projectWeeks: string;
};

type ParseResponse = {
  bandName: string;
  productionName: string;
  stops: ParsedStop[];
  skipped: Array<{ rowIndex: number; reason: string }>;
};

type GeocodeProgress = {
  completed: number;
  total: number;
  failed: number;
};

export function ExcelUploader() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState<GeocodeProgress | null>(null);
  const [geocodeFailed, setGeocodeFailed] = useState<Array<{ schoolName: string; concertTime: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setError(null);
    setParsed(null);
    try {
      // Hent projektuge-map fra server (ingen persondata involveret)
      const pwRes = await fetch("/api/project-weeks");
      const pwObj = await pwRes.json() as Record<string, string>;
      const projectWeeksMap = new Map(Object.entries(pwObj));

      // Parser Excel-filen direkte i browseren — filen forlader aldrig computeren
      const buffer = await file.arrayBuffer();
      const result = parseTourPlan(buffer, projectWeeksMap);

      setParsed({
        bandName: result.bandName,
        productionName: result.productionName,
        stops: result.stops.map((s) => ({ ...s, concertDate: s.concertDate.toISOString() })),
        skipped: result.skipped,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke læse filen");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleStartPlanning() {
    if (!parsed) return;
    setIsGeocoding(true);
    setGeocodeFailed(null);

    const total = parsed.stops.length;
    setGeocodeProgress({ completed: 0, total, failed: 0 });

    try {
      const geocodedStops: ParsedStop[] = [];
      const failed: Array<{ schoolName: string; concertTime: string }> = [];

      for (let i = 0; i < parsed.stops.length; i++) {
        const stop = parsed.stops[i];

        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stops: [stop] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Geocoding fejlede");

        geocodedStops.push(...(data.stops as ParsedStop[]));
        if ((data.failedStops as Array<{ schoolName: string; concertTime: string }>).length > 0) {
          failed.push(...(data.failedStops as Array<{ schoolName: string; concertTime: string }>));
        }

        setGeocodeProgress({ completed: i + 1, total, failed: failed.length });
      }

      sessionStorage.setItem("lms_parsed_stops", JSON.stringify(geocodedStops));
      sessionStorage.setItem("lms_band_name", parsed.bandName);
      sessionStorage.setItem("lms_production_name", parsed.productionName);

      if (failed.length > 0) {
        setGeocodeFailed(failed);
      } else {
        router.push("/planner");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl under geocoding");
    } finally {
      setIsGeocoding(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Drop-zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
        }`}
      >
        <p className="mb-4 text-gray-600">
          Træk en turné-Excel-fil hertil, eller klik for at vælge.
        </p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading || isGeocoding}>
          {isUploading ? <><Spinner className="mr-2" />Parser…</> : "Vælg fil"}
        </Button>
      </div>

      {/* Fejl */}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4 text-red-900">
          <strong>Fejl:</strong> {error}
        </div>
      )}

      {/* Geocoding-progress */}
      {isGeocoding && geocodeProgress && (
        <div className="mt-4 rounded-md bg-blue-50 p-4">
          <p className="mb-2 text-sm font-medium text-blue-900">
            Indlæser koncerter… ({geocodeProgress.completed}/{geocodeProgress.total})
          </p>
          <div className="h-2 w-full rounded-full bg-blue-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${(geocodeProgress.completed / geocodeProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Advarsel: geocoding-fejl før navigation */}
      {geocodeFailed && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-1 font-semibold text-amber-900">
            {geocodeFailed.length} koncert(er) mangler kortkoordinater
          </h3>
          <p className="mb-3 text-sm text-amber-800">
            Disse skoler fremgår i listen, men kan ikke vises på kortet:
          </p>
          <ul className="mb-4 space-y-1 rounded border border-amber-200 bg-white px-3 py-2 text-sm">
            {geocodeFailed.map((f, i) => (
              <li key={i} className="flex items-center gap-2 py-0.5">
                <span className="font-medium text-amber-900">{f.schoolName}</span>
                <span className="text-amber-600">{f.concertTime}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push("/planner")}>
              Fortsæt alligevel →
            </Button>
            <button
              onClick={() => setGeocodeFailed(null)}
              className="text-sm text-amber-700 underline hover:text-amber-900"
            >
              Gå tilbage
            </button>
          </div>
        </div>
      )}

      {/* Parse-resultat preview */}
      {parsed && !isGeocoding && !geocodeFailed && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{parsed.bandName || "Ukendt musikgruppe"}</h2>
              <p className="text-sm text-gray-600">
                {parsed.stops.length} koncert(er)
                {parsed.skipped.length > 0 && `, ${parsed.skipped.length} sprunget over`}
              </p>
            </div>
            <Button onClick={handleStartPlanning}>
              Start planlægning →
            </Button>
          </div>

          {parsed.skipped.length > 0 && (
            <details className="mb-4 rounded bg-yellow-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                {parsed.skipped.length} sprunget over
              </summary>
              <ul className="mt-2 space-y-1">
                {parsed.skipped.map((s) => (
                  <li key={s.rowIndex}>Række {s.rowIndex}: {s.reason}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="max-h-72 overflow-y-auto rounded border border-gray-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="p-2 text-left">Dato</th>
                  <th className="p-2 text-left">Tid</th>
                  <th className="p-2 text-left">Skole</th>
                  <th className="p-2 text-left">By</th>
                  <th className="p-2 text-left">Område</th>
                </tr>
              </thead>
              <tbody>
                {parsed.stops.map((s, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-2">{new Date(s.concertDate).toLocaleDateString("da-DK")}</td>
                    <td className="p-2">{s.concertTime}</td>
                    <td className="p-2 font-medium">{s.schoolName}</td>
                    <td className="p-2">{s.city}</td>
                    <td className="p-2 text-gray-500">{s.area}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
