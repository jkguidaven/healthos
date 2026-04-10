/**
 * Dashboard "Daily insight" tooltip — pure rule engine.
 *
 * Picks the single most relevant coaching hint to surface above the
 * dashboard tiles, based ONLY on data the dashboard already pulls. No
 * AI call, no extra DB query — this means the hint can re-derive on
 * every tab focus and respond instantly when the user logs food, water
 * or a workout and switches back.
 *
 * Rules are evaluated in priority order; the first match wins. The
 * priority is roughly "what would a real coach call out first" —
 * urgent gaps before celebratory wins, plus a friendly default for
 * users who haven't logged anything yet.
 *
 * Why a priority list and not multiple chips:
 *   The dashboard tile is intentionally a *tooltip*, not a digest. The
 *   full multi-insight surface is the Coach tab. Showing one focused
 *   hint here keeps the dashboard scannable in under 3 seconds, which
 *   is the design system goal.
 *
 * The output `tone` lets the dashboard pill choose its colour later
 * without re-implementing the rules.
 *
 * Pure TypeScript. No React, Drizzle, or AI imports.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CoachHintTone = 'win' | 'nudge' | 'watch' | 'neutral'

export interface CoachHint {
  /** Single sentence to render in the dashboard tile. */
  message: string
  /** Semantic colour bucket for the dot / pill in the tile. */
  tone: CoachHintTone
  /** Stable id for analytics + dedupe across renders. */
  rule:
    | 'no-profile'
    | 'no-meals-morning'
    | 'no-meals-midday'
    | 'no-meals-evening'
    | 'protein-very-behind-evening'
    | 'protein-behind-afternoon'
    | 'calories-way-over'
    | 'workouts-target-hit'
    | 'workouts-missed-week-end'
    | 'workouts-on-track'
    | 'water-behind-evening'
    | 'macros-dialled-in'
    | 'cached-coach-message'
    | 'returning-default'
    | 'welcome-default'
}

export interface CoachHintInput {
  /** Local hour 0–23. Drives morning/afternoon/evening rules. */
  hour: number
  /** True once the user has finished onboarding. */
  hasProfile: boolean

  // Goals (from profile row)
  goalCalories: number
  goalProteinG: number

  // Today's totals
  todayCalories: number
  todayProteinG: number
  /** Number of food_log rows for today. 0 means user hasn't logged a thing. */
  mealsLogged: number
  todayWaterMl: number
  waterTarget: number

  // Workouts this calendar week (Mon–Sun) and the user's per-week target.
  workoutsThisWeek: number
  workoutTarget: number
  /** 0 = Sunday, 1 = Monday … 6 = Saturday. */
  dayOfWeek: number

  /**
   * The most recent cached AI coaching message (one-sentence excerpt
   * from `coach_entry.content`). Used as a richer fallback when no
   * urgent rule applies. Null when nothing is cached yet.
   */
  cachedCoachMessage: string | null
}

// ─────────────────────────────────────────────────────────────
// Constants — kept here so they can be tuned without touching rules.
// ─────────────────────────────────────────────────────────────

/** A dialled-in day is within ±10% of the calorie goal AND hit protein. */
const CALORIE_DIALLED_PCT = 0.1
/** "Way over" = at least this fraction above the goal. */
const CALORIE_OVER_PCT = 0.2
/** "Very behind" protein in the evening = below this fraction of goal. */
const PROTEIN_VERY_BEHIND_PCT = 0.6
/** "Behind" protein in the afternoon = below this fraction of goal. */
const PROTEIN_BEHIND_PCT = 0.5
/** "Behind" water in the evening = below this fraction of target. */
const WATER_BEHIND_PCT = 0.6

const HOUR_MORNING_END = 11
const HOUR_AFTERNOON_END = 16
const HOUR_EVENING_START = 17

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function deriveCoachHint(input: CoachHintInput): CoachHint {
  // 1. No profile yet → onboarding nudge.
  if (!input.hasProfile) {
    return {
      rule: 'no-profile',
      tone: 'neutral',
      message:
        'Finish your profile and your daily coaching note will land here.',
    }
  }

  // 2. Nothing logged today — vary the tone with the time of day.
  if (input.mealsLogged === 0 && input.todayCalories === 0) {
    if (input.hour <= HOUR_MORNING_END) {
      return {
        rule: 'no-meals-morning',
        tone: 'neutral',
        message: 'Good morning. Start with breakfast and let the rest follow.',
      }
    }
    if (input.hour <= HOUR_AFTERNOON_END) {
      return {
        rule: 'no-meals-midday',
        tone: 'nudge',
        message:
          'Half the day’s gone — log your first meal to keep momentum going.',
      }
    }
    return {
      rule: 'no-meals-evening',
      tone: 'watch',
      message:
        'Nothing logged today yet. Even a quick entry now keeps your streak alive.',
    }
  }

  const proteinPct =
    input.goalProteinG > 0 ? input.todayProteinG / input.goalProteinG : 0
  const caloriesPct =
    input.goalCalories > 0 ? input.todayCalories / input.goalCalories : 0
  const waterPct =
    input.waterTarget > 0 ? input.todayWaterMl / input.waterTarget : 0
  const isEvening = input.hour >= HOUR_EVENING_START
  const isAfternoonOrLater = input.hour >= HOUR_AFTERNOON_END

  // 3. Protein is the #1 recomp variable — call it out aggressively.
  if (isEvening && proteinPct < PROTEIN_VERY_BEHIND_PCT) {
    const remaining = Math.max(
      0,
      Math.round(input.goalProteinG - input.todayProteinG),
    )
    return {
      rule: 'protein-very-behind-evening',
      tone: 'watch',
      message: `You’re ${remaining}g short on protein — a shake or yoghurt closes the gap fast.`,
    }
  }
  if (isAfternoonOrLater && proteinPct < PROTEIN_BEHIND_PCT) {
    return {
      rule: 'protein-behind-afternoon',
      tone: 'nudge',
      message: `Protein is at ${Math.round(proteinPct * 100)}% — make the next meal a high-protein one.`,
    }
  }

  // 4. Calories way over — gentle nudge, never alarmist.
  if (caloriesPct > 1 + CALORIE_OVER_PCT) {
    const over = Math.round(input.todayCalories - input.goalCalories)
    return {
      rule: 'calories-way-over',
      tone: 'nudge',
      message: `You’re ${over}kcal over today — a lighter dinner keeps the week on track.`,
    }
  }

  // 5. Workout balance.
  if (
    input.workoutTarget > 0 &&
    input.workoutsThisWeek >= input.workoutTarget
  ) {
    return {
      rule: 'workouts-target-hit',
      tone: 'win',
      message: `You’ve hit ${input.workoutsThisWeek}/${input.workoutTarget} workouts this week — recovery counts too.`,
    }
  }
  // dayOfWeek: 0 = Sunday, 5 = Friday. Late in the week with zero workouts.
  if (
    input.workoutTarget > 0 &&
    input.workoutsThisWeek === 0 &&
    (input.dayOfWeek === 0 || input.dayOfWeek >= 5)
  ) {
    return {
      rule: 'workouts-missed-week-end',
      tone: 'watch',
      message:
        'No workouts logged this week yet — even one session protects muscle mass during a deficit.',
    }
  }

  // 6. Water is a small but real recomp lever.
  if (isEvening && waterPct < WATER_BEHIND_PCT) {
    return {
      rule: 'water-behind-evening',
      tone: 'nudge',
      message:
        'You’re behind on water — hydration helps recovery and appetite control.',
    }
  }

  // 7. Everything looks good — celebrate it.
  if (
    proteinPct >= 1 &&
    Math.abs(caloriesPct - 1) <= CALORIE_DIALLED_PCT &&
    input.mealsLogged >= 2
  ) {
    return {
      rule: 'macros-dialled-in',
      tone: 'win',
      message:
        'Today is dialled in — protein hit and calories right where they should be.',
    }
  }

  // 8. Otherwise, fall back to the cached AI coaching message if available.
  if (input.cachedCoachMessage && input.cachedCoachMessage.trim().length > 0) {
    return {
      rule: 'cached-coach-message',
      tone: 'neutral',
      message: trimToSentence(input.cachedCoachMessage),
    }
  }

  // 9. Final default — friendly, never noisy.
  if (input.workoutsThisWeek > 0 || input.mealsLogged > 0) {
    return {
      rule: 'returning-default',
      tone: 'neutral',
      message:
        'Steady wins. Keep logging and your coach will spot the patterns worth knowing.',
    }
  }
  return {
    rule: 'welcome-default',
    tone: 'neutral',
    message:
      'Log a meal, a workout, or your weight to unlock specific coaching.',
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Pick the first sentence (or up to ~140 chars) from a longer message
 * so the dashboard tile stays scannable. Strips trailing whitespace.
 */
function trimToSentence(message: string): string {
  const cleaned = message.trim()
  // Split on the first sentence terminator that isn't an abbreviation.
  const match = cleaned.match(/^(.+?[.!?])(\s|$)/)
  if (match && match[1].length >= 20) {
    return match[1].trim()
  }
  if (cleaned.length <= 140) return cleaned
  return `${cleaned.slice(0, 137).trimEnd()}…`
}
