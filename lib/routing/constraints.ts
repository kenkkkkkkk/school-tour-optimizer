/**
 * Forretningsregler for turnéplanlægning.
 * Disse bruges både af optimizer og af UI-validator.
 */

export const MAX_CONCERTS_PER_DAY = 3;
export const MAX_SCHOOLS_PER_DAY = 2;
export const MAX_SCHOOLS_WITH_EVENING = 3;
export const CONCERT_DURATION_MIN = 45;
export const SETUP_TEARDOWN_MIN = 35;

/** Første koncert må tidligst starte kl. 08:30 */
export const FIRST_CONCERT_EARLIEST = "08:30";

/** Sidste DAG-koncert må starte senest kl. 12:00 */
export const LAST_DAY_CONCERT_START = "12:00";

/**
 * Afstand (meter) mellem sidste stop og næste dags første stop
 * hvor vi anbefaler overnatning frem for at køre hjem.
 */
export const HOTEL_REQUIRED_THRESHOLD_M = 100_000;

/** Evening-koncerter er typisk på efterskoler kl. 17+ */
export const EVENING_CONCERT_HOUR_THRESHOLD = 17;
