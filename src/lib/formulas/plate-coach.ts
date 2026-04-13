/**
 * src/lib/formulas/plate-coach.ts
 *
 * "Today's plate" coach — the Food tab's nutrition coaching card.
 *
 * Pure TypeScript rule engine + food ranker. Given today's macro totals,
 * the user's goals, which meal slots have been filled, the current hour,
 * and a deduped list of recent foods with macros, it produces:
 *   - a tone bucket the card uses to pick colours + collapsing
 *   - a one-line headline
 *   - one or two sentences of detail
 *   - 0–3 concrete food suggestions drawn from the user's recent logs,
 *     ranked by how well they close the day's remaining protein gap
 *     without blowing the calorie budget
 *
 * Deliberate design choices:
 *   - Pure function. No React, Drizzle, AI, or I/O imports.
 *   - Never shame the user. "Over" tone is forward-looking only.
 *   - Suggestions always come from foods the user has *actually logged*
 *     recently — users repeat their plates; novelty suggestions get
 *     ignored. The food-scan recent-foods anchor is the same principle.
 *   - Protein density is the ranking key — grams of protein per kcal.
 *     This prefers lean, dense choices (chicken breast, Greek yogurt)
 *     over calorie-heavy mixed dishes even if the latter has more total
 *     protein.
 *
 * The formula is stable and cheap, so callers should re-run it on every
 * food-log focus without memoising.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PlateCoachTone =
  | 'empty'      // nothing logged yet
  | 'behind'     // meaningfully short on protein (or calories) for this hour
  | 'on-track'   // partway through the day, trajectory fine
  | 'ahead'      // hit all targets, within calorie window
  | 'over'       // meaningfully over calorie goal

export interface PlateCoachSuggestion {
  /** Food name as it was logged — uses the user's own casing. */
  name: string
  /** Short reason anchored to what this food contributes. */
  reason: string
  proteinG: number
  calories: number
}

export interface PlateCoachOutput {
  tone: PlateCoachTone
  /** Single sentence suitable for the compact pill / Home mirror. */
  headline: string
  /** 1–2 sentences for the expanded Food-tab card. */
  detail: string
  /** 0–3 items. Populated when there's a meaningful gap to close. */
  suggestions: PlateCoachSuggestion[]
  /** Card should render as a compact pill rather than a full section. */
  collapsed: boolean
  /** Stable id for analytics + debugging. */
  rule:
    | 'no-profile'
    | 'no-meals-morning'
    | 'no-meals-midday'
    | 'no-meals-evening'
    | 'protein-very-behind-evening'
    | 'protein-behind-afternoon'
    | 'calories-way-over'
    | 'dialled-in'
    | 'on-track-morning'
    | 'on-track-midday'
    | 'on-track-evening'
}

export interface PlateCoachRecentFood {
  name: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface PlateCoachInput {
  hour: number
  hasProfile: boolean

  // Goals
  goalCalories: number
  goalProteinG: number

  // Today's totals (summed from food_log)
  todayCalories: number
  todayProteinG: number
  mealsLogged: number
  /** Which meal slots already have ≥ 1 entry today. */
  loggedSlots: ReadonlySet<MealSlot>

  /** Deduped list of foods the user has logged recently. Most frequent first. */
  recentFoods: readonly PlateCoachRecentFood[]
}

// ─────────────────────────────────────────────────────────────
// Tunable thresholds — mirror coach-hint where they overlap.
// ─────────────────────────────────────────────────────────────

const CALORIE_DIALLED_PCT = 0.1          // within ±10% of goal
const CALORIE_OVER_PCT = 0.2             // > 20% above goal → 'over' tone
const PROTEIN_VERY_BEHIND_PCT = 0.6      // evening: < 60% of goal
const PROTEIN_BEHIND_PCT = 0.5           // afternoon: < 50% of goal

const HOUR_MORNING_END = 11
const HOUR_AFTERNOON_END = 16
const HOUR_EVENING_START = 17

const MAX_SUGGESTIONS = 3

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function computePlateCoach(input: PlateCoachInput): PlateCoachOutput {
  // 1. No profile → render nothing meaningful; let the caller hide the card.
  if (!input.hasProfile) {
    return {
      rule: 'no-profile',
      tone: 'empty',
      headline: 'Finish your profile to unlock plate coaching.',
      detail: 'Once your goals are set, today\u2019s plate coach will land here with specific food suggestions.',
      suggestions: [],
      collapsed: false,
    }
  }

  // 2. Nothing logged yet → time-of-day prompt, no suggestions.
  if (input.mealsLogged === 0 && input.todayCalories === 0) {
    if (input.hour <= HOUR_MORNING_END) {
      return {
        rule: 'no-meals-morning',
        tone: 'empty',
        headline: 'Start with breakfast when you\u2019re ready.',
        detail: 'A protein-forward breakfast (30g+) sets the day up — Greek yogurt, eggs, or a shake all work.',
        suggestions: [],
        collapsed: false,
      }
    }
    if (input.hour <= HOUR_AFTERNOON_END) {
      return {
        rule: 'no-meals-midday',
        tone: 'empty',
        headline: 'Half the day is gone — log your first meal.',
        detail: 'Aim for something around a third of your protein goal in this one to keep the day recoverable.',
        suggestions: [],
        collapsed: false,
      }
    }
    return {
      rule: 'no-meals-evening',
      tone: 'empty',
      headline: 'Nothing logged yet. Even a quick entry helps.',
      detail: 'Log whatever you ate earlier first — accurate history is more useful than a perfect day.',
      suggestions: [],
      collapsed: false,
    }
  }

  const proteinPct =
    input.goalProteinG > 0 ? input.todayProteinG / input.goalProteinG : 0
  const caloriesPct =
    input.goalCalories > 0 ? input.todayCalories / input.goalCalories : 0
  const isEvening = input.hour >= HOUR_EVENING_START
  const isAfternoonOrLater = input.hour >= HOUR_AFTERNOON_END

  const proteinGapG = Math.max(
    0,
    Math.round(input.goalProteinG - input.todayProteinG),
  )
  const calorieBudgetKcal = Math.max(
    0,
    Math.round(input.goalCalories - input.todayCalories),
  )

  // 3. Calories way over → forward-looking nudge.
  if (caloriesPct > 1 + CALORIE_OVER_PCT) {
    const over = Math.round(input.todayCalories - input.goalCalories)
    return {
      rule: 'calories-way-over',
      tone: 'over',
      headline: `You\u2019re ${over} kcal over today.`,
      detail: 'No shame — go protein-forward tomorrow and let today settle. One day doesn\u2019t move the trend.',
      suggestions: [],
      collapsed: false,
    }
  }

  // 4. Protein badly short in the evening → urgent, with suggestions.
  if (isEvening && proteinPct < PROTEIN_VERY_BEHIND_PCT) {
    const suggestions = rankProteinSuggestions({
      recentFoods: input.recentFoods,
      proteinGapG,
      calorieBudgetKcal,
    })
    return {
      rule: 'protein-very-behind-evening',
      tone: 'behind',
      headline: `You\u2019re ${proteinGapG}g short on protein.`,
      detail: suggestions.length > 0
        ? 'These recent picks would close most of the gap without blowing your calorie budget.'
        : 'A shake, Greek yogurt, or cottage cheese closes the gap quickly.',
      suggestions,
      collapsed: false,
    }
  }

  // 5. Protein behind in the afternoon → steer the next meal.
  if (isAfternoonOrLater && proteinPct < PROTEIN_BEHIND_PCT) {
    const suggestions = rankProteinSuggestions({
      recentFoods: input.recentFoods,
      proteinGapG,
      calorieBudgetKcal,
    })
    return {
      rule: 'protein-behind-afternoon',
      tone: 'behind',
      headline: `Protein is at ${Math.round(proteinPct * 100)}% — steer dinner toward it.`,
      detail: suggestions.length > 0
        ? 'Recent foods that would help you land the target:'
        : 'Make your next meal protein-forward — lean meat, fish, Greek yogurt, or cottage cheese.',
      suggestions,
      collapsed: false,
    }
  }

  // 6. Everything dialled in → collapse to a compact compliment pill.
  if (
    proteinPct >= 1 &&
    Math.abs(caloriesPct - 1) <= CALORIE_DIALLED_PCT &&
    input.mealsLogged >= 2
  ) {
    return {
      rule: 'dialled-in',
      tone: 'ahead',
      headline: 'Today is dialled in — protein hit, calories in the zone.',
      detail: 'Keep the exact pattern tomorrow. Consistency beats optimisation.',
      suggestions: [],
      collapsed: true,
    }
  }

  // 7. On-track default — partway through the day, nothing screaming.
  if (input.hour <= HOUR_MORNING_END) {
    return {
      rule: 'on-track-morning',
      tone: 'on-track',
      headline: `Good start — ${Math.round(input.todayProteinG)}g protein logged.`,
      detail: `You have ${calorieBudgetKcal} kcal and ${proteinGapG}g protein left for the day.`,
      suggestions: [],
      collapsed: false,
    }
  }
  if (isAfternoonOrLater) {
    // Pick a small nudge list even on track — the user opening the tab
    // means they're thinking about what to eat next.
    const suggestions = rankProteinSuggestions({
      recentFoods: input.recentFoods,
      proteinGapG,
      calorieBudgetKcal,
    }).slice(0, 2)
    return {
      rule: 'on-track-evening',
      tone: 'on-track',
      headline: `On track — ${proteinGapG}g protein and ${calorieBudgetKcal} kcal left.`,
      detail: suggestions.length > 0
        ? 'Recent foods that fit what\u2019s left of today:'
        : 'Trajectory\u2019s fine. Keep the next meal protein-forward.',
      suggestions,
      collapsed: false,
    }
  }
  return {
    rule: 'on-track-midday',
    tone: 'on-track',
    headline: `On track — ${proteinGapG}g protein left.`,
    detail: `${calorieBudgetKcal} kcal remaining. Pick a protein-forward lunch to stay comfortable at dinner.`,
    suggestions: [],
    collapsed: false,
  }
}

// ─────────────────────────────────────────────────────────────
// Food ranker
// ─────────────────────────────────────────────────────────────

interface RankArgs {
  recentFoods: readonly PlateCoachRecentFood[]
  proteinGapG: number
  calorieBudgetKcal: number
}

/**
 * Pick up to {@link MAX_SUGGESTIONS} foods from the recent list, ranked
 * by protein density (g protein per kcal) with a calorie-fit filter so
 * we never suggest a single food that would blow the remaining budget.
 *
 * Falls back to the highest-protein items if none fit the budget — the
 * card copy warns the user to halve the portion rather than pretending
 * those options don't exist.
 */
function rankProteinSuggestions({
  recentFoods,
  proteinGapG,
  calorieBudgetKcal,
}: RankArgs): PlateCoachSuggestion[] {
  if (recentFoods.length === 0) return []
  if (proteinGapG <= 0) return []

  // Only consider foods with a non-trivial amount of protein and valid
  // calorie values — otherwise we end up recommending rice as a protein
  // source.
  const viable = recentFoods.filter(
    (f) => f.proteinG >= 8 && f.calories > 0,
  )
  if (viable.length === 0) return []

  // Score by protein density (g/kcal), tie-break by absolute protein.
  const scored = viable
    .map((f) => ({
      food: f,
      density: f.proteinG / f.calories,
    }))
    .sort((a, b) => {
      if (b.density !== a.density) return b.density - a.density
      return b.food.proteinG - a.food.proteinG
    })

  // Prefer foods that fit the remaining calorie budget if there is one.
  const fitting = calorieBudgetKcal > 0
    ? scored.filter((s) => s.food.calories <= calorieBudgetKcal)
    : scored
  const pool = fitting.length > 0 ? fitting : scored

  return pool.slice(0, MAX_SUGGESTIONS).map(({ food }) => ({
    name: food.name,
    reason: buildReason(food, calorieBudgetKcal),
    proteinG: Math.round(food.proteinG),
    calories: Math.round(food.calories),
  }))
}

function buildReason(
  food: PlateCoachRecentFood,
  calorieBudgetKcal: number,
): string {
  const proteinG = Math.round(food.proteinG)
  const kcal = Math.round(food.calories)
  if (calorieBudgetKcal > 0 && food.calories > calorieBudgetKcal) {
    return `${proteinG}g protein · ${kcal} kcal (halve the portion to fit today)`
  }
  return `${proteinG}g protein · ${kcal} kcal`
}
