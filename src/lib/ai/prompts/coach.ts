// ═══════════════════════════════════════════════════════════════
// src/lib/ai/prompts/coach.ts
// ─────────────────────────────────────────────────────────────
// Daily coaching prompt. Synthesises the user's nutrition, workout
// and body-metrics data from the past 7 days into a personalised
// coaching message. The coach explicitly understands recomposition
// and never treats scale weight as the primary success metric.
//
// Authoritative spec: ai-prompts.md § 3.
// Do not paraphrase the system prompt or relax the Zod bounds
// without updating the spec first.
//
// The context object is assembled by `src/lib/db/queries/coach.ts`
// from five tables; this file only knows how to serialise it into
// a prompt and validate the response.
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod'
import { callAI, type GeminiResponseSchema } from '../ai-client'

// ─────────────────────────────────────────────────────────────
// System instruction — exact string from ai-prompts.md § 3.
// ─────────────────────────────────────────────────────────────

export const COACH_SYSTEM_PROMPT = `You are a body recomposition coach. You give personalised, evidence-based coaching based on a user's actual logged data.

YOUR UNDERSTANDING OF RECOMPOSITION:
- Recomposition = losing fat while building muscle simultaneously. It is slower than a pure bulk or cut.
- Scale weight is an unreliable short-term indicator for recomp. It fluctuates ±1–2kg from glycogen, water, and food volume. Never treat a week of scale increase as failure.
- The real recomp signals are: waist measurement decreasing, strength increasing, body fat % decreasing over 4+ weeks.
- Protein is the most critical dietary variable. Under-eating protein is the #1 recomp mistake.
- Progressive overload (adding weight/reps consistently) is the primary driver of muscle retention during a deficit.
- A slight caloric surplus on training days and slight deficit on rest days is optimal for recomp, but do not be prescriptive about exact numbers.

YOUR TONE:
- Direct, encouraging, evidence-based. Not cheerleader-generic ("Great job!"). Not harsh.
- Acknowledge what the data shows, then give one specific, actionable insight.
- If data is missing (user hasn't logged), acknowledge it without guilt-tripping.
- Keep the coaching message under 3 sentences. Insights and action items can be longer.

OUTPUT RULES:
- message: 1–3 sentences. The main coaching thought for today.
- insights: 2–4 strings. Specific observations from the data. Can be positive or constructive.
- action_items: 1–3 strings. Concrete things to do today or this week.
- mood: "great" if the data shows clear recomp progress. "good" if on track. "check_in" if something needs attention (low protein, missed workouts, plateau). Never "bad" or "poor".
- weekly_highlight: one sentence celebrating the best thing from this week's data.

The response schema is enforced. You MUST use these exact field names: message, insights, action_items, mood, weekly_highlight.`

// ─────────────────────────────────────────────────────────────
// Context shape — populated from SQLite by buildCoachContext().
// Keep field names + nullability in lockstep with ai-prompts.md.
// ─────────────────────────────────────────────────────────────

export interface CoachContext {
  // User profile
  profile: {
    sex: 'male' | 'female'
    age: number
    weightKg: number
    goalCalories: number
    goalProteinG: number
    goalCarbsG: number
    goalFatG: number
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  }

  // Today's nutrition (from food_log, summed). null if no entries today.
  todayNutrition: {
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
    waterMl: number
    mealsLogged: number
  } | null

  // Last 7 days nutrition averages
  weekNutritionAvg: {
    caloriesAvg: number
    proteinGAvg: number
    daysProteinHit: number // days where protein >= goal
    daysLogged: number // days with any food entries
  } | null

  // Last completed workout session
  lastWorkout: {
    sessionName: string // e.g. "Push A"
    date: string // YYYY-MM-DD
    daysAgo: number
    exerciseCount: number
    anyPRs: boolean // true if any set exceeded previous best
  } | null

  // Workouts this week
  weekWorkouts: {
    count: number
    targetCount: number // from plan
  }

  // Body metrics — latest snapshot vs ~30 days ago
  bodyMetrics: {
    weightKgLatest: number | null
    weightKg30dAgo: number | null
    waistCmLatest: number | null
    waistCm30dAgo: number | null
    bodyFatPctLatest: number | null
    bodyFatPct30dAgo: number | null
  } | null

  // Streaks
  streaks: {
    loggingStreak: number // consecutive days with food log entries
    workoutStreak: number // consecutive weeks hitting workout target
  }

  // Day context
  todayIsTrainingDay: boolean
  currentWeekOfPlan: number | null
}

// ─────────────────────────────────────────────────────────────
// Prompt builder — serialises CoachContext as structured text.
// Section dividers and labels are deliberate; the model parses
// them better than a JSON dump.
// ─────────────────────────────────────────────────────────────

export function buildCoachPrompt(context: CoachContext): string {
  const lines: string[] = [
    `=== USER CONTEXT ===`,
    `Profile: ${context.profile.sex}, ${context.profile.age}yo, ${context.profile.weightKg}kg`,
    `Goals: ${context.profile.goalCalories}kcal / P${context.profile.goalProteinG}g C${context.profile.goalCarbsG}g F${context.profile.goalFatG}g`,
    `Experience: ${context.profile.experienceLevel}`,
    `Today is a ${context.todayIsTrainingDay ? 'training' : 'rest'} day`,
    context.currentWeekOfPlan !== null
      ? `Currently in week ${context.currentWeekOfPlan} of their plan`
      : 'No active plan',
    ``,
    `=== TODAY'S NUTRITION ===`,
  ]

  if (context.todayNutrition && context.todayNutrition.mealsLogged > 0) {
    const n = context.todayNutrition
    lines.push(
      `Logged: ${n.calories}kcal / P${n.proteinG}g C${n.carbsG}g F${n.fatG}g`,
      `Water: ${n.waterMl}ml`,
      `Meals logged: ${n.mealsLogged}`,
    )
  } else {
    lines.push('Nothing logged today yet')
  }

  lines.push(``, `=== THIS WEEK'S NUTRITION ===`)
  if (context.weekNutritionAvg) {
    const w = context.weekNutritionAvg
    lines.push(
      `Avg calories: ${w.caloriesAvg}kcal`,
      `Avg protein: ${w.proteinGAvg}g`,
      `Days protein goal hit: ${w.daysProteinHit}/7`,
      `Days with food logged: ${w.daysLogged}/7`,
    )
  } else {
    lines.push('No nutrition data this week')
  }

  lines.push(``, `=== WORKOUTS ===`)
  if (context.lastWorkout) {
    const lw = context.lastWorkout
    lines.push(
      `Last session: ${lw.sessionName}, ${lw.daysAgo} day(s) ago`,
      `Exercises completed: ${lw.exerciseCount}`,
      `PRs in last session: ${lw.anyPRs ? 'yes' : 'no'}`,
    )
  } else {
    lines.push('No recent workout logged')
  }
  lines.push(
    `This week: ${context.weekWorkouts.count}/${context.weekWorkouts.targetCount} sessions completed`,
  )

  lines.push(``, `=== BODY METRICS (30-day comparison) ===`)
  if (context.bodyMetrics) {
    const m = context.bodyMetrics
    let any = false
    if (m.weightKgLatest !== null && m.weightKg30dAgo !== null) {
      lines.push(
        `Weight: ${m.weightKg30dAgo}kg → ${m.weightKgLatest}kg (${(
          m.weightKgLatest - m.weightKg30dAgo
        ).toFixed(1)}kg change)`,
      )
      any = true
    }
    if (m.waistCmLatest !== null && m.waistCm30dAgo !== null) {
      lines.push(
        `Waist: ${m.waistCm30dAgo}cm → ${m.waistCmLatest}cm (${(
          m.waistCmLatest - m.waistCm30dAgo
        ).toFixed(1)}cm change)`,
      )
      any = true
    }
    if (m.bodyFatPctLatest !== null && m.bodyFatPct30dAgo !== null) {
      lines.push(
        `Body fat: ${m.bodyFatPct30dAgo}% → ${m.bodyFatPctLatest}% (${(
          m.bodyFatPctLatest - m.bodyFatPct30dAgo
        ).toFixed(1)}% change)`,
      )
      any = true
    }
    if (!any) lines.push('No body metric history yet')
  } else {
    lines.push('No body metrics logged')
  }

  lines.push(
    ``,
    `=== STREAKS ===`,
    `Food logging streak: ${context.streaks.loggingStreak} days`,
    `Workout streak: ${context.streaks.workoutStreak} weeks`,
    ``,
    `Based on this data, provide today's coaching.`,
  )

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────
// Result schema — Zod for runtime validation, Gemini schema for
// structured-output enforcement at the model level.
// ─────────────────────────────────────────────────────────────

export const CoachResultSchema = z.object({
  message: z.string().min(10).max(400),
  insights: z.array(z.string().max(200)).min(1).max(5),
  action_items: z.array(z.string().max(200)).min(1).max(4),
  mood: z.enum(['great', 'good', 'check_in']),
  weekly_highlight: z.string().max(300),
})

export type CoachResult = z.infer<typeof CoachResultSchema>

export const CoachGeminiSchema: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    message: {
      type: 'STRING',
      description:
        'The main coaching thought for today. 1–3 sentences. Direct, evidence-based.',
    },
    insights: {
      type: 'ARRAY',
      description:
        '2–4 specific observations drawn from the user’s logged data.',
      items: { type: 'STRING' },
    },
    action_items: {
      type: 'ARRAY',
      description:
        '1–3 concrete actions the user should take today or this week.',
      items: { type: 'STRING' },
    },
    mood: {
      type: 'STRING',
      enum: ['great', 'good', 'check_in'],
      description:
        'Overall read on the data. Never use anything outside the enum.',
    },
    weekly_highlight: {
      type: 'STRING',
      description:
        'One sentence celebrating the best thing in this week’s data.',
    },
  },
  required: ['message', 'insights', 'action_items', 'mood', 'weekly_highlight'],
}

// ─────────────────────────────────────────────────────────────
// Public API — single function the feature hook calls.
// Centralising the maxTokens + responseSchema here keeps callers
// out of the AI client surface and makes the prompt easy to swap.
// ─────────────────────────────────────────────────────────────

const COACH_MAX_TOKENS = 2048

export async function callCoach(context: CoachContext): Promise<CoachResult> {
  return callAI<CoachResult>({
    system: COACH_SYSTEM_PROMPT,
    userMessage: buildCoachPrompt(context),
    schema: CoachResultSchema,
    maxTokens: COACH_MAX_TOKENS,
    responseSchema: CoachGeminiSchema,
  })
}
