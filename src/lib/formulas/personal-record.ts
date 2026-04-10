/**
 * Progressive overload — personal record + comparison helpers.
 *
 * Pure TypeScript. No React, Drizzle, or AI imports. Used by the workout
 * session logger to detect PRs as the user logs sets and to render
 * "+2.5kg from last week" overload deltas on Done cards.
 *
 * Why estimated 1RM, not raw weight?
 *   Comparing raw weight×reps doesn't capture the difference between, say,
 *   100kg × 5 and 95kg × 8 — both are real progress against different rep
 *   targets. Epley's e1RM gives a single scalar that ranks sets fairly
 *   across rep ranges:
 *
 *     e1RM = weight * (1 + reps / 30)
 *
 *   Epley is one of several established formulas (Brzycki, Lombardi, …);
 *   they all agree to within ~3% in the 1–10 rep range that matters for
 *   hypertrophy and strength work. We pick Epley for its simplicity.
 *
 *   Sets that have no weight (bodyweight movements like push-ups) fall
 *   back to a tonnage proxy: reps alone, treating any extra rep as a PR.
 */

export interface SetLike {
  weightKg: number | null
  reps: number | null
}

/**
 * Epley estimated 1-rep max. Returns null when the inputs aren't a real
 * working set (missing reps, zero reps, negative load, …) so callers can
 * distinguish "no PR computable" from "PR is zero".
 */
export function estimateOneRepMax(set: SetLike): number | null {
  const reps = set.reps
  if (reps === null || !Number.isFinite(reps) || reps <= 0) return null

  const weight = set.weightKg
  if (weight === null) {
    // Bodyweight movement — fall back to rep count as the comparison key.
    return reps
  }
  if (!Number.isFinite(weight) || weight < 0) return null

  return weight * (1 + reps / 30)
}

/**
 * Best estimated 1RM across a list of sets. Returns null when no set in
 * the list yields a usable e1RM (e.g. all empty / all in-progress).
 */
export function bestOneRepMax(sets: readonly SetLike[]): number | null {
  let best: number | null = null
  for (const set of sets) {
    const e1rm = estimateOneRepMax(set)
    if (e1rm === null) continue
    if (best === null || e1rm > best) best = e1rm
  }
  return best
}

/**
 * Returns true when `candidate` strictly exceeds the best e1RM in
 * `history`. An empty history is NOT a PR — the first time a user logs
 * an exercise we don't want to celebrate it as a record. A small epsilon
 * guards against floating-point noise (e.g. 100.00000001 vs 100).
 */
export function isPersonalRecord(
  candidate: SetLike,
  history: readonly SetLike[],
): boolean {
  if (history.length === 0) return false
  const candidateE1RM = estimateOneRepMax(candidate)
  if (candidateE1RM === null) return false

  const previousBest = bestOneRepMax(history)
  if (previousBest === null) return false

  const epsilon = 1e-6
  return candidateE1RM > previousBest + epsilon
}

/**
 * Difference (in kg) between the best e1RM of `current` and `previous`.
 * Used to render "+2.5kg from last week" overload badges. Returns null
 * when either side has no usable sets — the UI should hide the badge.
 *
 * Rounded to 1 decimal place to keep the badge readable.
 */
export function getOverloadDeltaKg(
  current: readonly SetLike[],
  previous: readonly SetLike[],
): number | null {
  const currentBest = bestOneRepMax(current)
  const previousBest = bestOneRepMax(previous)
  if (currentBest === null || previousBest === null) return null
  return Math.round((currentBest - previousBest) * 10) / 10
}

/**
 * Pick the "headline" set from a list — the one with the highest e1RM —
 * so the UI can render "Last week: 80kg × 8". Falls back to the last
 * logged set when no set has a numeric e1RM.
 */
export function getTopSet(sets: readonly SetLike[]): SetLike | null {
  if (sets.length === 0) return null
  let topSet: SetLike | null = null
  let topE1RM = -Infinity
  for (const set of sets) {
    const e1rm = estimateOneRepMax(set)
    if (e1rm === null) continue
    if (e1rm > topE1RM) {
      topE1RM = e1rm
      topSet = set
    }
  }
  return topSet ?? sets[sets.length - 1]
}
