/**
 * Recomposition signal classifier.
 *
 * Given week-over-week deltas in weight, waist, and arm circumference,
 * return a plain-English interpretation of what the body is doing.
 *
 * Recomp is sneaky: the scale can stay flat while body composition
 * improves. This classifier distinguishes "plateau" (which may still
 * be recomp progress) from clearer success and failure modes.
 *
 * Pure TypeScript — no React, Drizzle, or AI imports.
 */

export type RecompSignal =
  | 'recomp_working' // weight up, waist down
  | 'lean_mass_building' // weight down, arm up
  | 'plateau' // weight stable
  | 'cut_progress' // weight down, waist down
  | 'bulk_progress' // weight up, arm up, waist stable
  | 'unclear' // not enough signal

export interface RecompSignalInput {
  /** Weight delta in kilograms (positive = gained, negative = lost). */
  weightDeltaKg: number
  /** Waist delta in centimetres, or null if not measured. */
  waistDeltaCm: number | null
  /** Arm delta in centimetres, or null if not measured. */
  armDeltaCm: number | null
}

export interface RecompSignalResult {
  signal: RecompSignal
  message: string
}

/** Threshold (kg) below which weight is considered "stable". */
const PLATEAU_THRESHOLD_KG = 0.3

/** Threshold (cm) within which waist is considered "holding" during a bulk. */
const BULK_WAIST_HOLD_CM = 0.5

export function getRecompSignal(input: RecompSignalInput): RecompSignalResult {
  const { weightDeltaKg, waistDeltaCm, armDeltaCm } = input

  // 1. Scale up + waist down → recomp is working.
  if (weightDeltaKg > 0 && waistDeltaCm !== null && waistDeltaCm < 0) {
    return {
      signal: 'recomp_working',
      message: 'Scale up but waist down — recomp is working',
    }
  }

  // 2. Scale down + arm up → lean mass building while losing fat.
  if (weightDeltaKg < 0 && armDeltaCm !== null && armDeltaCm > 0) {
    return {
      signal: 'lean_mass_building',
      message: 'Scale down, arm up — lean mass building',
    }
  }

  // 3. Weight essentially flat → classic recomp plateau.
  if (Math.abs(weightDeltaKg) < PLATEAU_THRESHOLD_KG) {
    return {
      signal: 'plateau',
      message: 'Weight stable — typical recomp plateau, check measurements',
    }
  }

  // 4. Scale down + waist down → fat loss.
  if (weightDeltaKg < 0 && waistDeltaCm !== null && waistDeltaCm < 0) {
    return {
      signal: 'cut_progress',
      message: 'Both weight and waist down — fat loss progressing',
    }
  }

  // 5. Scale up + arm up + waist holding → clean bulk.
  if (
    weightDeltaKg > 0 &&
    armDeltaCm !== null &&
    armDeltaCm > 0 &&
    waistDeltaCm !== null &&
    Math.abs(waistDeltaCm) <= BULK_WAIST_HOLD_CM
  ) {
    return {
      signal: 'bulk_progress',
      message: 'Weight and arm up, waist holding — clean bulk',
    }
  }

  return {
    signal: 'unclear',
    message: 'Not enough signal yet — log more data points',
  }
}
