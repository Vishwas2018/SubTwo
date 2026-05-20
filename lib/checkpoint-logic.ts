import { predictTime } from './pace-zones';

export type CheckpointVerdict = 'green' | 'amber' | 'red';

export type CheckpointInput = {
  target_km: number;
  actual_km: number;
  weeks_to_race: number;
};

export type CheckpointResult = {
  deviation_pct: number;
  verdict: CheckpointVerdict;
  recommended_action: string;
};

export type SuggestedCheckpoint = {
  week_number: number;
  target_distance_km: number;
  predicted_time_seconds: number;
};

// Thresholds matching SQL compute_checkpoint_verdict
export const VERDICT_GREEN_THRESHOLD = 3; // within 3% below target → green
export const VERDICT_AMBER_THRESHOLD = 10; // within 10% below target → amber

/**
 * Compute percentage deviation: positive = ahead, negative = behind.
 * deviation_pct = (actual − target) / target × 100
 */
export function computeDeviation(actualKm: number, targetKm: number): number {
  if (!Number.isFinite(targetKm) || targetKm <= 0) {
    throw new Error(`targetKm must be positive, got: ${targetKm}`);
  }
  if (!Number.isFinite(actualKm) || actualKm < 0) {
    throw new Error(`actualKm must be non-negative, got: ${actualKm}`);
  }
  return ((actualKm - targetKm) / targetKm) * 100;
}

/**
 * Classify a deviation into a verdict.
 * Matches SQL compute_checkpoint_verdict function:
 *   >= -3%  → green
 *   >= -10% → amber
 *   <  -10% → red
 */
export function computeVerdict(deviationPct: number): CheckpointVerdict {
  if (deviationPct >= -VERDICT_GREEN_THRESHOLD) return 'green';
  if (deviationPct >= -VERDICT_AMBER_THRESHOLD) return 'amber';
  return 'red';
}

/** Generate coaching action text from verdict and weeks remaining. */
export function recommendedAction(verdict: CheckpointVerdict, weeksToRace: number): string {
  if (verdict === 'green') {
    return 'On track — maintain current training load.';
  }
  if (verdict === 'amber') {
    if (weeksToRace >= 8) {
      return 'Slightly behind — consider adding one easy run per week to build mileage gradually.';
    }
    return 'Slightly behind with limited time — prioritise key quality sessions over additional volume.';
  }
  // red
  if (weeksToRace >= 8) {
    return 'Significantly behind — reassess weekly mileage and consider adjusting your race goal.';
  }
  return 'Significantly behind with limited time — consider adjusting your race goal to match current fitness.';
}

/** Evaluate a single checkpoint: deviation → verdict → action. */
export function evaluateCheckpoint(input: CheckpointInput): CheckpointResult {
  const deviation_pct = computeDeviation(input.actual_km, input.target_km);
  const verdict = computeVerdict(deviation_pct);
  return {
    deviation_pct,
    verdict,
    recommended_action: recommendedAction(verdict, input.weeks_to_race),
  };
}

/**
 * Use Riegel to derive the expected checkpoint time for a shorter distance.
 * Delegates to predictTime from pace-zones.
 */
export function deriveCheckpointTarget(
  raceDistanceKm: number,
  goalSeconds: number,
  checkpointDistanceKm: number
): number {
  return predictTime(raceDistanceKm, goalSeconds, checkpointDistanceKm);
}

/**
 * Suggest 3 checkpoints at ~25%, 50%, and 80% of plan duration.
 * Target distances are 25%, 50%, and 75% of the race distance.
 */
export function suggestCheckpoints(
  totalWeeks: number,
  raceDistanceKm: number,
  goalSeconds: number
): SuggestedCheckpoint[] {
  if (!Number.isFinite(totalWeeks) || totalWeeks < 1) {
    throw new Error(`totalWeeks must be a positive integer, got: ${totalWeeks}`);
  }

  const pcts = [0.25, 0.5, 0.8] as const;
  const distancePcts = [0.25, 0.5, 0.75] as const;

  return pcts.map((pct, i) => {
    const targetDist = raceDistanceKm * distancePcts[i]!;
    return {
      week_number: Math.round(totalWeeks * pct),
      target_distance_km: targetDist,
      predicted_time_seconds: deriveCheckpointTarget(raceDistanceKm, goalSeconds, targetDist),
    };
  });
}
