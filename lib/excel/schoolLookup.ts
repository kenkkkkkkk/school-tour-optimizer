import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// Kolonne-indeks i Skoler2627.xlsx (0-baseret)
const COL_SCHOOL = 0;        // A – Skole
const COL_MUNICIPALITY = 1;  // B – Kommune
const COL_PROJECT_WEEKS = 2; // C – Faste projektuger

type ProjectWeeksMap = Map<string, string>;

let _cache: ProjectWeeksMap | null = null;

function makeKey(schoolName: string, municipality: string): string {
  return `${schoolName.toLowerCase().trim()}|${municipality.toLowerCase().trim()}`;
}

function loadMap(): ProjectWeeksMap {
  if (_cache) return _cache;

  const filePath = path.join(process.cwd(), "Skoler2627.xlsx");
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

  const map: ProjectWeeksMap = new Map();
  for (const row of rows.slice(1)) {
    const r = row as unknown[];
    const school = String(r[COL_SCHOOL] ?? "").trim();
    const municipality = String(r[COL_MUNICIPALITY] ?? "").trim();
    const weeks = String(r[COL_PROJECT_WEEKS] ?? "").trim();
    if (school && weeks) {
      map.set(makeKey(school, municipality), weeks);
    }
  }

  _cache = map;
  return map;
}

/**
 * Slår faste projektuger op for en given skole+kommune.
 * Returnerer tom streng hvis ingen data findes eller opslaget fejler.
 */
export function getProjectWeeks(schoolName: string, municipality: string): string {
  try {
    return loadMap().get(makeKey(schoolName, municipality)) ?? "";
  } catch {
    return "";
  }
}

/** Returnerer hele projektuge-mappet — bruges til at eksponere data som JSON til klienten. */
export function getProjectWeeksMap(): ProjectWeeksMap {
  try {
    return loadMap();
  } catch {
    return new Map();
  }
}
