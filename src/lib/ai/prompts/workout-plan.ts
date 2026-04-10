// ═══════════════════════════════════════════════════════════════
// src/lib/ai/prompts/workout-plan.ts
// ─────────────────────────────────────────────────────────────
// Workout plan generation prompts. A full plan with 4-6 days and
// 6-12 exercises per day easily exceeds Gemini 2.5 Flash's output
// token budget when generated in a single call, so we split the
// generation into two phases:
//
//   1. Overview — plan metadata + day skeletons (just names + muscle
//      groups + estimated duration). Small response, fits comfortably.
//   2. Day exercises — for each day from the overview, a focused
//      call that generates only that day's exercises. Runs in parallel.
//
// The hook orchestrates the two phases and assembles the final
// WorkoutPlanResult shape that downstream code already expects.
//
// Authoritative spec: ai-prompts.md § 2.
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod'
import type { GeminiResponseSchema } from '../ai-client'

// ─────────────────────────────────────────────────────────────
// Shared coaching philosophy — used in both overview and day prompts.
// ─────────────────────────────────────────────────────────────

const COACHING_PRINCIPLES = `You are an experienced strength and conditioning coach specialising in natural body recomposition. You create periodised workout programmes grounded in sports science.

PRINCIPLES YOU ALWAYS APPLY:
- Progressive overload is the primary driver of muscle gain. Every plan must have a clear progression scheme (e.g. add 2.5kg when 3×8 is achieved cleanly).
- For recomposition, compound movements (squat, deadlift, bench, row, overhead press) are the foundation. Isolation work supplements, never replaces.
- Rest periods matter: 90–120s for compound lifts, 60s for isolation. Always specify.
- Volume: 10–20 working sets per muscle group per week is the hypertrophy sweet spot. Do not exceed this.
- Frequency: each muscle group trained 2× per week minimum for recomp.
- Exercise order: compound lifts first, isolation last within a session.
- Warm-up sets are assumed but not listed in the plan. Working sets only.
- RPE guidance: working sets should feel like RPE 7–8 (2–3 reps in reserve), not to failure.

RECOMPOSITION-SPECIFIC RULES:
- Do not programme cardio within this plan — the user handles this separately.
- Do not mention calorie targets or diet advice — this is a training plan only.
- Beginner: 3 full-body sessions/week, linear progression, 3×8–10 per exercise.
- Intermediate: Upper/Lower or PPL split, 4–5 sessions/week, double progression.
- Advanced: PPL or specialisation blocks, 5–6 sessions/week, RPE-based loading.`

// ─────────────────────────────────────────────────────────────
// PHASE 1 — Overview prompt (plan metadata + day skeletons)
// ─────────────────────────────────────────────────────────────

export const WORKOUT_OVERVIEW_SYSTEM_PROMPT = `${COACHING_PRINCIPLES}

OUTPUT RULES:
- The plan_rationale field (max 3 sentences) explains why this structure suits the user's goal.
- For each TRAINING day, provide: day_name (e.g. "Push A"), muscle_groups (primary muscles trained), and estimated_duration_minutes.
- Do NOT include exercises in this response — exercises are generated in a separate follow-up call.

CRITICAL — about the 'days' array:
- The 'days' array contains UNIQUE TRAINING SESSION TEMPLATES, not a 7-day weekly calendar.
- The number of items in 'days' MUST EQUAL the requested days_per_week. If the user asks for 4 days/week, return exactly 4 day objects.
- DO NOT include rest days. Rest days are not training sessions and must not appear in the array.
- Every day object MUST have a non-empty muscle_groups array (1-6 muscle groups) and estimated_duration_minutes between 20 and 120.
- Use distinct day names like "Push A", "Push B", "Pull A", "Pull B", "Legs A", "Legs B", "Upper A", "Upper B", "Lower A", "Lower B", or "Full Body A", "Full Body B", etc. — depending on the split.

Example for a 4-day Upper/Lower split:
{
  "days": [
    { "day_name": "Upper A", "muscle_groups": ["chest", "back", "shoulders", "triceps", "biceps"], "estimated_duration_minutes": 60 },
    { "day_name": "Lower A", "muscle_groups": ["quads", "hamstrings", "glutes", "calves"], "estimated_duration_minutes": 60 },
    { "day_name": "Upper B", "muscle_groups": ["chest", "back", "shoulders", "triceps", "biceps"], "estimated_duration_minutes": 60 },
    { "day_name": "Lower B", "muscle_groups": ["quads", "hamstrings", "glutes", "calves"], "estimated_duration_minutes": 60 }
  ]
}

Example for a 4-day PPL split (one extra Push/Pull/Legs day cycled):
{
  "days": [
    { "day_name": "Push", "muscle_groups": ["chest", "shoulders", "triceps"], "estimated_duration_minutes": 60 },
    { "day_name": "Pull", "muscle_groups": ["back", "biceps"], "estimated_duration_minutes": 60 },
    { "day_name": "Legs", "muscle_groups": ["quads", "hamstrings", "glutes", "calves"], "estimated_duration_minutes": 65 },
    { "day_name": "Upper", "muscle_groups": ["chest", "back", "shoulders", "triceps", "biceps"], "estimated_duration_minutes": 60 }
  ]
}

The response schema is enforced. You MUST use these exact field names: plan_name, plan_rationale, split_type, weeks_total, days_per_week, days[].day_name, days[].muscle_groups[], days[].estimated_duration_minutes.`

export interface WorkoutPlanRequest {
  // From profile
  age: number
  sex: 'male' | 'female'
  weightKg: number
  goal: 'recomposition' | 'bulk' | 'cut'
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'

  // From the plan generator form
  split: 'full_body' | 'upper_lower' | 'ppl'
  daysPerWeek: 2 | 3 | 4 | 5 | 6
  durationWeeks: 4 | 6 | 8 | 12
  equipment: string[]
  focusMuscles?: string[]
}

export function buildWorkoutOverviewPrompt(request: WorkoutPlanRequest): string {
  const focusLine =
    request.focusMuscles && request.focusMuscles.length > 0
      ? `\n- Muscle groups to emphasise: ${request.focusMuscles.join(', ')}`
      : ''

  return `Outline a ${request.durationWeeks}-week ${request.split.replace('_', ' ')} workout plan.

User profile:
- Age: ${request.age}, sex: ${request.sex}, weight: ${request.weightKg}kg
- Goal: ${request.goal}
- Experience: ${request.experienceLevel}
- Training days per week: ${request.daysPerWeek}
- Available equipment: ${request.equipment.join(', ')}${focusLine}

The 'days' array MUST contain EXACTLY ${request.daysPerWeek} unique training session templates (no rest days, no extras). Each entry needs a non-empty muscle_groups array and a duration of at least 30 minutes.

Provide the plan structure: name, rationale, split type, weeks, and the list of training days (day name + muscle groups + estimated duration). DO NOT list exercises — those come in a separate call.`
}

const OverviewDaySchema = z.object({
  day_name: z.string().min(1).max(50),
  muscle_groups: z.array(z.string()).min(1).max(6),
  estimated_duration_minutes: z.number().int().min(20).max(120),
})

export const WorkoutOverviewSchema = z.object({
  plan_name: z.string().min(1).max(100),
  plan_rationale: z.string().max(500),
  split_type: z.enum(['full_body', 'upper_lower', 'ppl', 'custom']),
  weeks_total: z.number().int().min(4).max(16),
  days_per_week: z.number().int().min(2).max(6),
  days: z.array(OverviewDaySchema).min(1).max(6),
})

export type WorkoutOverview = z.infer<typeof WorkoutOverviewSchema>
export type WorkoutOverviewDay = z.infer<typeof OverviewDaySchema>

export const WorkoutOverviewGeminiSchema: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    plan_name: { type: 'STRING' },
    plan_rationale: { type: 'STRING' },
    split_type: {
      type: 'STRING',
      enum: ['full_body', 'upper_lower', 'ppl', 'custom'],
    },
    weeks_total: { type: 'INTEGER' },
    days_per_week: { type: 'INTEGER' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          day_name: { type: 'STRING' },
          muscle_groups: { type: 'ARRAY', items: { type: 'STRING' } },
          estimated_duration_minutes: { type: 'INTEGER' },
        },
        required: ['day_name', 'muscle_groups', 'estimated_duration_minutes'],
      },
    },
  },
  required: [
    'plan_name',
    'plan_rationale',
    'split_type',
    'weeks_total',
    'days_per_week',
    'days',
  ],
}

// ─────────────────────────────────────────────────────────────
// PHASE 2 — Day exercises prompt (one call per day)
// ─────────────────────────────────────────────────────────────

export const WORKOUT_DAY_EXERCISES_SYSTEM_PROMPT = `${COACHING_PRINCIPLES}

OUTPUT RULES:
- Generate the working-set exercises for ONE training day.
- Exercise names must be standard, searchable names (e.g. "Barbell back squat" not "squats").
- sets and reps fields are integers. weight_kg is null (user fills in their working weight).
- rest_seconds is an integer number of seconds (90-120 for compound, 60 for isolation).
- Include a progression_note per exercise explaining exactly how to progress.
- 4-8 exercises per day is the typical range. More for full-body, fewer for split days.

The response schema is enforced. You MUST use these exact field names: exercises[].name, exercises[].sets, exercises[].reps, exercises[].rest_seconds, exercises[].weight_kg, exercises[].tempo, exercises[].progression_note.`

export interface WorkoutDayExercisesRequest {
  // Profile context (lets the model tailor exercise selection)
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  goal: 'recomposition' | 'bulk' | 'cut'
  equipment: string[]

  // The day to plan
  dayName: string
  muscleGroups: string[]
  estimatedDurationMinutes: number
}

export function buildWorkoutDayExercisesPrompt(
  request: WorkoutDayExercisesRequest,
): string {
  return `Generate the working-set exercises for this training day.

Day: ${request.dayName}
Primary muscle groups: ${request.muscleGroups.join(', ')}
Estimated session duration: ${request.estimatedDurationMinutes} minutes

User context:
- Experience: ${request.experienceLevel}
- Goal: ${request.goal}
- Available equipment: ${request.equipment.join(', ')}

Order: compound lifts first, isolation last. Working sets only.`
}

const ExerciseSchema = z.object({
  name: z.string().min(2).max(100),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(30),
  rest_seconds: z.number().int().min(30).max(300),
  weight_kg: z.number().nullable(),
  tempo: z.string().max(20).optional(),
  progression_note: z.string().max(300),
})

export const WorkoutDayExercisesSchema = z.object({
  exercises: z.array(ExerciseSchema).min(2).max(12),
})

export type WorkoutDayExercises = z.infer<typeof WorkoutDayExercisesSchema>

export const WorkoutDayExercisesGeminiSchema: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          sets: { type: 'INTEGER' },
          reps: { type: 'INTEGER' },
          rest_seconds: { type: 'INTEGER' },
          weight_kg: { type: 'NUMBER', nullable: true },
          tempo: { type: 'STRING' },
          progression_note: { type: 'STRING' },
        },
        required: [
          'name',
          'sets',
          'reps',
          'rest_seconds',
          'progression_note',
        ],
      },
    },
  },
  required: ['exercises'],
}

// ─────────────────────────────────────────────────────────────
// Combined result type — what the hook produces after assembling
// the overview + per-day exercises into a single object.
// ─────────────────────────────────────────────────────────────

const WorkoutDaySchema = OverviewDaySchema.extend({
  exercises: z.array(ExerciseSchema).min(2).max(12),
})

export const WorkoutPlanResultSchema = z.object({
  plan_name: z.string().min(1).max(100),
  plan_rationale: z.string().max(500),
  split_type: z.enum(['full_body', 'upper_lower', 'ppl', 'custom']),
  weeks_total: z.number().int().min(4).max(16),
  days_per_week: z.number().int().min(2).max(6),
  days: z.array(WorkoutDaySchema).min(1).max(6),
})

export type WorkoutPlanResult = z.infer<typeof WorkoutPlanResultSchema>
