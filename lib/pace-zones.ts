/**
 * Pace zone calculations for SubTwo training plan generation.
 *
 * Zone derivation method:
 *   - Race pace is the anchor (goal_seconds / race_distance_km)
 *   - All zones are offset from race pace using distance-aware constants
 *   - Riegel formula: T2 = T1 * (D2/D1)^1.06  (Peter Riegel, 1977)
 *   - Zones follow the "slower is the min bound, faster is the max bound" convention
 *     i.e. min_seconds_per_km > max_seconds_per_km (slower pace = more seconds/km)
 */

// ─────── Constants ────────────────────────────────────────────────────────────

const SECONDS_PER_HOUR = 3600;
export const KM_PER_MILE = 1.609344;

/** Riegel exponent for endurance running fatigue curve. */
const RIEGEL_EXPONENT = 1.06;

/**
 * Distance-aware offsets (seconds/km) from race pace.
 * Positive = slower than race pace, negative = faster.
 */
const ZONE_OFFSETS = {
  short: {
    // 5K / 10K
    threshold_center: 8,
    threshold_half_width: 4,
    interval_center: -8,
    interval_half_width: 6,
    marathon_pace_center: 20,
    marathon_pace_half_width: 8,
  },
  half: {
    // Half marathon ~21.1 km
    threshold_center: -6,
    threshold_half_width: 5,
    interval_center: -40,
    interval_half_width: 10,
    marathon_pace_center: 10,
    marathon_pace_half_width: 6,
  },
  full: {
    // Marathon ~42.2 km
    threshold_center: -20,
    threshold_half_width: 8,
    interval_center: -50,
    interval_half_width: 12,
    marathon_pace_center: 0, // marathon pace IS race pace for marathon
    marathon_pace_half_width: 5,
  },
} as const;

// ─────── Types ────────────────────────────────────────────────────────────────

export type PaceZone = {
  /** Upper bound: slowest acceptable pace (more seconds/km) */
  min_seconds_per_km: number;
  /** Lower bound: fastest acceptable pace (fewer seconds/km) */
  max_seconds_per_km: number;
  rpe_min: number;
  rpe_max: number;
};

export type PaceZones = {
  recovery: PaceZone;
  easy: PaceZone;
  long_run: PaceZone;
  marathon_pace: PaceZone;
  race_pace: PaceZone;
  threshold: PaceZone;
  interval: PaceZone;
};

// ─────── Core Functions ───────────────────────────────────────────────────────

/**
 * Parse "H:MM:SS", "MM:SS", or "M:SS" into total seconds.
 * Throws on invalid format or negative/zero values.
 */
export function timeStringToSeconds(time: string): number {
  if (!time || typeof time !== 'string') {
    throw new Error(`Invalid time string: "${time}"`);
  }

  const parts = time.trim().split(':');

  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid time format "${time}": expected H:MM:SS or MM:SS`);
  }

  const nums = parts.map((p) => {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error(`Invalid time segment "${p}" in "${time}"`);
    }
    return n;
  });

  let seconds: number;
  if (nums.length === 3) {
    // H:MM:SS
    const [h, m, s] = nums as [number, number, number];
    if (m >= 60 || s >= 60) throw new Error(`Invalid time "${time}": minutes/seconds must be < 60`);
    seconds = h * SECONDS_PER_HOUR + m * 60 + s;
  } else {
    // MM:SS or M:SS
    const [m, s] = nums as [number, number];
    if (s >= 60) throw new Error(`Invalid time "${time}": seconds must be < 60`);
    seconds = m * 60 + s;
  }

  if (seconds <= 0) {
    throw new Error(`Time "${time}" must be greater than zero`);
  }

  return seconds;
}

/**
 * Format total seconds as "H:MM:SS" or "MM:SS".
 * @param options.forceHours - always include the hours component
 */
export function secondsToTimeString(seconds: number, options?: { forceHours?: boolean }): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`Invalid seconds value: ${seconds}`);
  }

  const totalSeconds = Math.round(seconds);
  const h = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const m = Math.floor((totalSeconds % SECONDS_PER_HOUR) / 60);
  const s = totalSeconds % 60;

  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  if (h > 0 || options?.forceHours) {
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${ss}`;
}

/**
 * Compute goal pace in seconds/km.
 * @param raceDistanceKm - race distance in kilometres
 * @param goalSeconds - goal finish time in seconds
 */
export function goalPace(raceDistanceKm: number, goalSeconds: number): number {
  if (!Number.isFinite(raceDistanceKm) || raceDistanceKm <= 0) {
    throw new Error(`raceDistanceKm must be a positive number, got: ${raceDistanceKm}`);
  }
  if (!Number.isFinite(goalSeconds) || goalSeconds <= 0) {
    throw new Error(`goalSeconds must be a positive number, got: ${goalSeconds}`);
  }
  return goalSeconds / raceDistanceKm;
}

/**
 * Predict finish time for a target distance using the Riegel formula:
 *   T2 = T1 × (D2 / D1)^1.06
 *
 * Reference: Peter Riegel, "Athletic Records and Human Endurance", American Scientist, 1977.
 *
 * @param knownDistanceKm - distance of the known performance
 * @param knownTimeSeconds - time of the known performance in seconds
 * @param targetDistanceKm - distance to predict for
 * @returns predicted time in seconds
 */
export function predictTime(
  knownDistanceKm: number,
  knownTimeSeconds: number,
  targetDistanceKm: number
): number {
  if (!Number.isFinite(knownDistanceKm) || knownDistanceKm <= 0) {
    throw new Error(`knownDistanceKm must be positive, got: ${knownDistanceKm}`);
  }
  if (!Number.isFinite(knownTimeSeconds) || knownTimeSeconds <= 0) {
    throw new Error(`knownTimeSeconds must be positive, got: ${knownTimeSeconds}`);
  }
  if (!Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0) {
    throw new Error(`targetDistanceKm must be positive, got: ${targetDistanceKm}`);
  }

  return knownTimeSeconds * Math.pow(targetDistanceKm / knownDistanceKm, RIEGEL_EXPONENT);
}

/** Select the right offset profile based on race distance. */
function selectOffsetProfile(raceDistanceKm: number) {
  if (raceDistanceKm <= 12) return ZONE_OFFSETS.short;
  if (raceDistanceKm <= 30) return ZONE_OFFSETS.half;
  return ZONE_OFFSETS.full;
}

/** Build a PaceZone from center pace + half-width + RPE range. */
function makeZone(centerPace: number, halfWidth: number, rpeMin: number, rpeMax: number): PaceZone {
  return {
    min_seconds_per_km: Math.round(centerPace + halfWidth), // slower bound
    max_seconds_per_km: Math.round(centerPace - halfWidth), // faster bound
    rpe_min: rpeMin,
    rpe_max: rpeMax,
  };
}

/**
 * Derive full training pace zones from a race goal.
 *
 * Anchor: race_pace = goalSeconds / raceDistanceKm
 * All zones are offset from race pace using distance-aware constants.
 *
 * Zone ordering (slowest to fastest):
 *   recovery > easy > long_run > marathon_pace > race_pace > threshold > interval
 *
 * @param raceDistanceKm - race distance in km (e.g. 21.1 for half marathon)
 * @param goalSeconds - goal race time in seconds
 */
export function deriveZonesFromGoal(raceDistanceKm: number, goalSeconds: number): PaceZones {
  if (!Number.isFinite(raceDistanceKm) || raceDistanceKm <= 0) {
    throw new Error(`raceDistanceKm must be positive, got: ${raceDistanceKm}`);
  }
  if (!Number.isFinite(goalSeconds) || goalSeconds <= 0) {
    throw new Error(`goalSeconds must be positive, got: ${goalSeconds}`);
  }

  const racePace = goalSeconds / raceDistanceKm;
  const offsets = selectOffsetProfile(raceDistanceKm);

  return {
    // Recovery: very slow, ~2.5–3 min/km slower than race pace, RPE 1–2
    recovery: makeZone(racePace + 150, 30, 1, 2),

    // Easy: ~75–120 s/km slower than race pace, RPE 3–4
    easy: makeZone(racePace + 97, 22, 3, 4),

    // Long run: ~60–100 s/km slower than race pace, RPE 4–5
    long_run: makeZone(racePace + 80, 20, 4, 5),

    // Marathon pace: race-distance-aware offset, RPE 5–6
    marathon_pace: makeZone(
      racePace + offsets.marathon_pace_center,
      offsets.marathon_pace_half_width,
      5,
      6
    ),

    // Race pace: goal pace ± tight window, RPE 7–8
    race_pace: makeZone(racePace, 6, 7, 8),

    // Threshold: slightly faster than race pace (distance-dependent), RPE 8–9
    threshold: makeZone(racePace + offsets.threshold_center, offsets.threshold_half_width, 8, 9),

    // Intervals: significantly faster, short reps, RPE 9–10
    interval: makeZone(racePace + offsets.interval_center, offsets.interval_half_width, 9, 10),
  };
}

/**
 * Check whether a goal time is physiologically plausible.
 *
 * Bounds:
 *   - pace < 2:30/km (150 s/km) → impossibly fast for sustained amateur running
 *   - pace > 12:00/km (720 s/km) → walking pace, unlikely racing intent
 */
export function validateGoalPlausibility(
  raceDistanceKm: number,
  goalSeconds: number
): { plausible: boolean; reason?: string } {
  if (!Number.isFinite(raceDistanceKm) || raceDistanceKm <= 0) {
    return { plausible: false, reason: 'race distance must be a positive number' };
  }
  if (!Number.isFinite(goalSeconds) || goalSeconds <= 0) {
    return { plausible: false, reason: 'goal time must be a positive number' };
  }

  const paceSecondsPerKm = goalSeconds / raceDistanceKm;

  if (paceSecondsPerKm < 150) {
    return {
      plausible: false,
      reason: `pace of ${secondsToTimeString(Math.round(paceSecondsPerKm))}/km is sub-2:30/km — physiologically impossible for sustained racing`,
    };
  }

  if (paceSecondsPerKm > 720) {
    return {
      plausible: false,
      reason: `pace of ${secondsToTimeString(Math.round(paceSecondsPerKm))}/km exceeds 12:00/km — this is a walking pace`,
    };
  }

  return { plausible: true };
}

/**
 * Convert a pace in seconds/km to seconds/mile.
 * @param secondsPerKm - pace in seconds per kilometre
 * @returns pace in seconds per mile
 */
export function paceKmToMile(secondsPerKm: number): number {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    throw new Error(`secondsPerKm must be positive, got: ${secondsPerKm}`);
  }
  return secondsPerKm * KM_PER_MILE;
}
