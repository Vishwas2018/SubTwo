export type SessionType =
  | 'easy'
  | 'long_run'
  | 'threshold'
  | 'interval'
  | 'recovery'
  | 'rest'
  | 'race'
  | 'time_trial'
  | 'marathon_pace';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type PlannedSession = {
  week_number: number;
  day_of_week: number; // 1=Monday … 7=Sunday
  session_type: SessionType;
  distance_km?: number;
  target_pace_seconds_per_km?: number;
};

export type PlanInput = {
  experience_level: ExperienceLevel;
  sessions: PlannedSession[];
};

export type ValidationIssue = {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  week?: number;
};

export type ValidationResult = {
  /** false if any issue has severity 'error' */
  valid: boolean;
  issues: ValidationIssue[];
};

// ─── Exported thresholds ──────────────────────────────────────────────────────

export const VOLUME_INCREASE_CAP = 0.1;
export const DELOAD_WINDOW_MAX_WEEKS = 5;
export const DELOAD_VOLUME_MAX_PCT = 0.8;
export const DELOAD_VOLUME_MIN_PCT = 0.6;
export const LONG_RUN_MAX_PCT_OF_WEEK = 0.35;
export const MAX_QUALITY_SESSIONS_PER_WEEK = 2;
export const SESSION_MAX_DISTANCE_KM = 50;
export const WEEKLY_MIN_KM = 10;
export const WEEKLY_MAX_KM = 150;
export const TAPER_MAX_PCT_OF_PEAK = 0.5;
export const PEAK_KM_BY_LEVEL: Record<ExperienceLevel, number> = {
  beginner: 60,
  intermediate: 90,
  advanced: 130,
};

// ─── Private helpers ──────────────────────────────────────────────────────────

const QUALITY_TYPES = new Set<SessionType>(['threshold', 'interval', 'marathon_pace']);

function groupByWeek(sessions: PlannedSession[]): Map<number, PlannedSession[]> {
  const map = new Map<number, PlannedSession[]>();
  for (const s of sessions) {
    if (!map.has(s.week_number)) map.set(s.week_number, []);
    map.get(s.week_number)!.push(s);
  }
  return map;
}

function weeklyKm(sessions: PlannedSession[]): number {
  return sessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
}

function sortedWeeks(byWeek: Map<number, PlannedSession[]>): number[] {
  return [...byWeek.keys()].sort((a, b) => a - b);
}

// ─── Rule 1: Structural integrity ────────────────────────────────────────────

export function validateStructuralIntegrity(sessions: PlannedSession[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const s of sessions) {
    if (!Number.isInteger(s.day_of_week) || s.day_of_week < 1 || s.day_of_week > 7) {
      issues.push({
        rule: 'structural_integrity',
        severity: 'error',
        message: `Week ${s.week_number}: day_of_week ${s.day_of_week} is out of range 1–7`,
        week: s.week_number,
      });
    }
  }

  const seen = new Set<string>();
  for (const s of sessions) {
    const key = `${s.week_number}-${s.day_of_week}`;
    if (seen.has(key)) {
      issues.push({
        rule: 'structural_integrity',
        severity: 'error',
        message: `Week ${s.week_number}, day ${s.day_of_week}: duplicate session`,
        week: s.week_number,
      });
    }
    seen.add(key);
  }

  const byWeek = groupByWeek(sessions);
  const weeks = sortedWeeks(byWeek);
  if (weeks.length > 0) {
    const first = weeks[0]!;
    if (first !== 1) {
      issues.push({
        rule: 'structural_integrity',
        severity: 'error',
        message: `Week numbers must start at 1, found first week: ${first}`,
      });
    }
    for (let i = 1; i < weeks.length; i++) {
      if (weeks[i]! !== weeks[i - 1]! + 1) {
        issues.push({
          rule: 'structural_integrity',
          severity: 'error',
          message: `Non-sequential weeks: ${weeks[i - 1]} followed by ${weeks[i]}`,
        });
      }
    }
  }

  return issues;
}

// ─── Rule 2: Volume progression ───────────────────────────────────────────────

export function validateVolumeProgression(sessions: PlannedSession[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byWeek = groupByWeek(sessions);
  const weeks = sortedWeeks(byWeek);
  const volumes = weeks.map((w) => weeklyKm(byWeek.get(w)!));

  for (let i = 1; i < weeks.length; i++) {
    const prevVol = volumes[i - 1]!;
    const currVol = volumes[i]!;
    const week = weeks[i]!;

    // Deload week: current drops to ≤ 80% of previous — always allowed
    if (prevVol > 0 && currVol <= prevVol * DELOAD_VOLUME_MAX_PCT) continue;

    // Post-deload: previous week was a deload — allow jumping back to prior peak
    if (i >= 2) {
      const prevPrevVol = volumes[i - 2]!;
      const prevWasDeload = prevPrevVol > 0 && prevVol <= prevPrevVol * DELOAD_VOLUME_MAX_PCT;
      if (prevWasDeload) continue;
    }

    if (prevVol > 0 && currVol > prevVol * (1 + VOLUME_INCREASE_CAP)) {
      const pct = Math.round(((currVol / prevVol) - 1) * 100);
      issues.push({
        rule: 'volume_progression',
        severity: 'error',
        message: `Week ${week}: volume increase of ${pct}% exceeds ${VOLUME_INCREASE_CAP * 100}% cap (${prevVol.toFixed(1)} → ${currVol.toFixed(1)} km)`,
        week,
      });
    }
  }

  return issues;
}

// ─── Rule 3: Deload cadence ───────────────────────────────────────────────────

export function validateDeloadCadence(sessions: PlannedSession[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byWeek = groupByWeek(sessions);
  const weeks = sortedWeeks(byWeek);
  const volumes = weeks.map((w) => weeklyKm(byWeek.get(w)!));

  let consecutiveNonDeload = 1; // week 1 always counts as non-deload
  for (let i = 1; i < weeks.length; i++) {
    const prevVol = volumes[i - 1]!;
    const currVol = volumes[i]!;
    const isDeload = prevVol > 0 && currVol <= prevVol * DELOAD_VOLUME_MAX_PCT;

    if (isDeload) {
      consecutiveNonDeload = 0;
    } else {
      consecutiveNonDeload++;
    }

    if (consecutiveNonDeload > DELOAD_WINDOW_MAX_WEEKS) {
      issues.push({
        rule: 'deload_cadence',
        severity: 'warning',
        message: `Week ${weeks[i]}: more than ${DELOAD_WINDOW_MAX_WEEKS} consecutive weeks without a deload`,
        week: weeks[i],
      });
      consecutiveNonDeload = 0;
    }
  }

  return issues;
}

// ─── Rule 4: Pace consistency ─────────────────────────────────────────────────

export function validatePaceConsistency(sessions: PlannedSession[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byWeek = groupByWeek(sessions);

  for (const [week, weekSessions] of byWeek) {
    for (const s of weekSessions) {
      if (QUALITY_TYPES.has(s.session_type) && s.target_pace_seconds_per_km === undefined) {
        issues.push({
          rule: 'pace_consistency',
          severity: 'error',
          message: `Week ${week}: ${s.session_type} session on day ${s.day_of_week} missing target_pace_seconds_per_km`,
          week,
        });
      }
    }

    const easySessions = weekSessions.filter(
      (s) => s.session_type === 'easy' && s.target_pace_seconds_per_km !== undefined
    );
    const thresholdSessions = weekSessions.filter(
      (s) => s.session_type === 'threshold' && s.target_pace_seconds_per_km !== undefined
    );

    for (const e of easySessions) {
      for (const t of thresholdSessions) {
        if (e.target_pace_seconds_per_km! <= t.target_pace_seconds_per_km!) {
          issues.push({
            rule: 'pace_consistency',
            severity: 'error',
            message: `Week ${week}: easy pace (${e.target_pace_seconds_per_km} s/km) must be slower than threshold pace (${t.target_pace_seconds_per_km} s/km)`,
            week,
          });
        }
      }
    }
  }

  return issues;
}

// ─── Rule 5: Distance bounds ──────────────────────────────────────────────────

export function validateDistanceBounds(sessions: PlannedSession[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byWeek = groupByWeek(sessions);
  const maxWeek = sessions.length > 0 ? Math.max(...sessions.map((s) => s.week_number)) : 0;

  for (const [week, weekSessions] of byWeek) {
    for (const s of weekSessions) {
      if (s.distance_km !== undefined && s.distance_km > SESSION_MAX_DISTANCE_KM) {
        issues.push({
          rule: 'distance_bounds',
          severity: 'error',
          message: `Week ${week}, day ${s.day_of_week}: session ${s.distance_km} km exceeds max ${SESSION_MAX_DISTANCE_KM} km`,
          week,
        });
      }
    }

    const totalKm = weeklyKm(weekSessions);
    const hasRunningSessions = weekSessions.some((s) => s.session_type !== 'rest');
    // Final (taper/race) week is exempt from WEEKLY_MIN_KM: it is already constrained by
    // the ≤50%-of-peak taper rule; forcing it above 10 km conflicts with valid low-volume plans.
    const isFinalWeek = week === maxWeek;

    if (hasRunningSessions) {
      if (totalKm < WEEKLY_MIN_KM && !isFinalWeek) {
        issues.push({
          rule: 'distance_bounds',
          severity: 'error',
          message: `Week ${week}: weekly volume ${totalKm.toFixed(1)} km is below minimum ${WEEKLY_MIN_KM} km`,
          week,
        });
      }
      if (totalKm > WEEKLY_MAX_KM) {
        issues.push({
          rule: 'distance_bounds',
          severity: 'error',
          message: `Week ${week}: weekly volume ${totalKm.toFixed(1)} km exceeds maximum ${WEEKLY_MAX_KM} km`,
          week,
        });
      }
    }

    const longRuns = weekSessions.filter(
      (s) => s.session_type === 'long_run' && s.distance_km !== undefined
    );
    for (const lr of longRuns) {
      if (totalKm > 0 && lr.distance_km! / totalKm > LONG_RUN_MAX_PCT_OF_WEEK) {
        const pct = Math.round((lr.distance_km! / totalKm) * 100);
        issues.push({
          rule: 'distance_bounds',
          severity: 'warning',
          message: `Week ${week}: long run (${lr.distance_km} km) is ${pct}% of weekly volume — guideline is ≤${LONG_RUN_MAX_PCT_OF_WEEK * 100}%`,
          week,
        });
      }
    }
  }

  return issues;
}

// ─── Rule 6: Recovery structure ───────────────────────────────────────────────

export function validateRecoveryStructure(sessions: PlannedSession[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byWeek = groupByWeek(sessions);

  for (const [week, weekSessions] of byWeek) {
    const restCount = weekSessions.filter((s) => s.session_type === 'rest').length;
    if (restCount === 0) {
      issues.push({
        rule: 'recovery_structure',
        severity: 'error',
        message: `Week ${week}: no rest day — at least 1 required`,
        week,
      });
    }

    const qualityCount = weekSessions.filter((s) => QUALITY_TYPES.has(s.session_type)).length;
    if (qualityCount > MAX_QUALITY_SESSIONS_PER_WEEK) {
      issues.push({
        rule: 'recovery_structure',
        severity: 'error',
        message: `Week ${week}: ${qualityCount} quality sessions found — maximum is ${MAX_QUALITY_SESSIONS_PER_WEEK}`,
        week,
      });
    }

    const sorted = [...weekSessions].sort((a, b) => a.day_of_week - b.day_of_week);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (
        QUALITY_TYPES.has(prev.session_type) &&
        QUALITY_TYPES.has(curr.session_type) &&
        curr.day_of_week === prev.day_of_week + 1
      ) {
        issues.push({
          rule: 'recovery_structure',
          severity: 'error',
          message: `Week ${week}: back-to-back quality sessions on days ${prev.day_of_week} and ${curr.day_of_week}`,
          week,
        });
      }
    }
  }

  return issues;
}

// ─── Rule 7: Race day and taper ───────────────────────────────────────────────

export function validateRaceDayAndTaper(sessions: PlannedSession[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byWeek = groupByWeek(sessions);
  const weeks = sortedWeeks(byWeek);

  if (weeks.length === 0) return issues;

  const finalWeek = weeks[weeks.length - 1]!;
  const finalSessions = byWeek.get(finalWeek)!;

  const hasRaceSession = finalSessions.some(
    (s) => s.session_type === 'race' || s.session_type === 'time_trial'
  );
  if (!hasRaceSession) {
    issues.push({
      rule: 'race_day_and_taper',
      severity: 'error',
      message: `Week ${finalWeek} (final week): no race or time_trial session found`,
      week: finalWeek,
    });
  }

  const volumes = weeks.map((w) => weeklyKm(byWeek.get(w)!));
  const peakVolume = Math.max(...volumes);
  const finalVolume = weeklyKm(finalSessions);

  if (peakVolume > 0 && finalVolume > peakVolume * TAPER_MAX_PCT_OF_PEAK) {
    const pct = Math.round((finalVolume / peakVolume) * 100);
    issues.push({
      rule: 'race_day_and_taper',
      severity: 'error',
      message: `Week ${finalWeek}: taper volume ${finalVolume.toFixed(1)} km is ${pct}% of peak — must be ≤${TAPER_MAX_PCT_OF_PEAK * 100}%`,
      week: finalWeek,
    });
  }

  return issues;
}

// ─── Rule 8: Experience level ─────────────────────────────────────────────────

export function validateExperienceLevel(
  sessions: PlannedSession[],
  experienceLevel: ExperienceLevel
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byWeek = groupByWeek(sessions);
  const weeks = [...byWeek.keys()];

  if (weeks.length === 0) return issues;

  const peakKm = Math.max(...weeks.map((w) => weeklyKm(byWeek.get(w)!)));
  const cap = PEAK_KM_BY_LEVEL[experienceLevel];

  if (peakKm > cap) {
    issues.push({
      rule: 'experience_level',
      severity: 'warning',
      message: `Peak weekly volume ${peakKm.toFixed(1)} km exceeds recommended ${cap} km for ${experienceLevel} runners`,
    });
  }

  return issues;
}

// ─── Master validator ─────────────────────────────────────────────────────────

export function validatePlan(plan: PlanInput): ValidationResult {
  const issues: ValidationIssue[] = [
    ...validateStructuralIntegrity(plan.sessions),
    ...validateVolumeProgression(plan.sessions),
    ...validateDeloadCadence(plan.sessions),
    ...validatePaceConsistency(plan.sessions),
    ...validateDistanceBounds(plan.sessions),
    ...validateRecoveryStructure(plan.sessions),
    ...validateRaceDayAndTaper(plan.sessions),
    ...validateExperienceLevel(plan.sessions, plan.experience_level),
  ];

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}
