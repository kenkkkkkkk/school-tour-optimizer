"use client";

import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const SESSION_KEY = "lms_musicians_raw";

type RawMusician = {
  bandName: string;
  productionName: string;
  firstName: string;
  lastName: string;
  address: string;
  postalCode: string;
  city: string;
};

export function MusicianUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [loadedCount, setLoadedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) setLoadedCount((JSON.parse(raw) as RawMusician[]).length);
    } catch { /* ignore */ }
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setIsParsing(true);
    try {
      // Parser Excel-filen direkte i browseren — filen forlader aldrig computeren
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[wb.SheetNames[0]],
        { defval: "" },
      );
      const musicians: RawMusician[] = rows
        .filter((r) => r["Musikgruppe"] && r["Produktion"])
        .map((r) => ({
          bandName:       String(r["Musikgruppe"]).trim(),
          productionName: String(r["Produktion"]).trim(),
          firstName:      String(r["Fornavn"] ?? "").trim(),
          lastName:       String(r["Efternavn"] ?? "").trim(),
          address:        String(r["Adresse"] ?? "").trim(),
          postalCode:     String(r["Postnummer"] ?? "").trim(),
          city:           String(r["By"] ?? "").trim(),
        }));
      if (musicians.length === 0) {
        throw new Error("Fandt ingen musikere i filen (mangler Musikgruppe/Produktion-kolonner?)");
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(musicians));
      setLoadedCount(musicians.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setIsParsing(false);
    }
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

  return (
    <section className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold">Musikerliste</h2>
      <p className="mb-4 text-sm text-gray-500">
        Upload Excel-fil med musikerdata én gang per session. Kun de musikere der matcher
        turnéplanens band og produktion geocodes. Data gemmes midlertidigt i browseren
        og forsvinder når fanen lukkes.
      </p>

      {loadedCount !== null && !isParsing && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
          ✓ {loadedCount} musikere klar (geocoding sker ved turnéupload)
          <button
            onClick={() => fileRef.current?.click()}
            className="ml-3 text-green-700 underline hover:no-underline"
          >
            Opdater
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        <p className="mb-3 text-sm text-gray-500">Træk Excel-fil med musikerdata hertil, eller klik for at vælge</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} className="hidden" />
        <Button onClick={() => fileRef.current?.click()} disabled={isParsing}>
          {isParsing ? <><Spinner className="mr-2" />Indlæser…</> : "Vælg fil"}
        </Button>
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-900">
          <strong>Fejl:</strong> {error}
        </div>
      )}
    </section>
  );
}
