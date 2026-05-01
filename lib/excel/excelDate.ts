/**
 * Excel gemmer datoer som decimaltal hvor heltallet = dage siden 1. jan 1900
 * (med en velkendt skudår-bug der behandler 1900 som skudår).
 * Decimaldelen = tid på dagen (0.5 = kl. 12:00).
 *
 * Formlen nedenfor kompenserer for skudår-bug'en via offset 25569 =
 * (70 år * 365 dage + 19 skuddage) mellem 1900-01-01 og 1970-01-01 (JS epoch).
 */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;

/**
 * Konverter Excel-decimaldato til en JS Date.
 * Returnerer Date objekt i UTC — tid-på-dagen bevares.
 */
export function excelDateToJS(excelDate: number): Date {
  if (!Number.isFinite(excelDate) || excelDate <= 0) {
    throw new Error(`Ugyldig Excel-dato: ${excelDate}`);
  }
  // Rund til nærmeste sekund — decimal-tider som 8.5/24 har floating-point
  // drift på ~1 ms, hvilket ellers kan tippe 08:30 ned til 08:29.
  const ms = Math.round((excelDate - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY / 1000) * 1000;
  return new Date(ms);
}

/**
 * Træk kun datoen ud (YYYY-MM-DD) uden tid.
 * Bruges til gruppering pr. dag og sammenligning med concert_date-kolonnen i DB.
 */
export function dateOnlyISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Træk tid-på-dagen ud som "HH:mm" fra en Excel-dato-Date.
 * Bruges til concert_time-feltet.
 */
export function timeOnlyHHMM(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
