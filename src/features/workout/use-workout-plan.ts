// ═══════════════════════════════════════════════════════════════
// src/features/workout/use-workout-plan.ts
// ─────────────────────────────────────────────────────────────
// Layer 3 (feature hook) for the workout plan generator.
//
// Generation runs in TWO PHASES because a full plan with 4-6 days and
// 6-12 exercises per day blows past Gemini 2.5 Flash's output token
// budget when produced in a single response (we get truncated mid-JSON):
//
//   Phase 1 (single call) — overview: plan metadata + day skeletons
//   Phase 2 (parallel calls) — one per day: exercises for that day
//
// The hook stitches the responses back into a WorkoutPlanResult and
// persists it through saveGeneratedPlan as before. Downstream code
// doesn't see the split.
//
// Errors from callAI (APIKeyMissingError, APIKeyInvalidError,
// AIParseError, AIApiError, AIRateLimitError) are intentionally
// NOT caught here — React Query surfaces them in `generateError`
// so the UI can narrow on `.code`.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import { z } from 'zod'
import { callAI } from '@ai/ai-client'
import {
  WORKOUT_OVERVIEW_SYSTEM_PROMPT,
  WORKOUT_DAY_EXERCISES_SYSTEM_PROMPT,
  WorkoutOverviewGeminiSchema,
  WorkoutOverviewSchema,
  WorkoutDayExercisesGeminiSchema,
  WorkoutDayExercisesSchema,
  buildWorkoutOverviewPrompt,
  buildWorkoutDayExercisesPrompt,
  type WorkoutPlanRequest,
  type WorkoutPlanResult,
  type WorkoutOverview,
  type WorkoutDayExercises,
} from '@ai/prompts/workout-plan'
import { saveGeneratedPlan, type SavePlanInput } from '@db/queries/workouts'
import * as schema from '@db/schema'
import { useProfileStore } from '@/stores/profile-store'

/**
 * A pre-Zod overview shape that's permissive about days. We catch it
 * here, normalise (drop rest-day garbage), then re-validate with the
 * stricter WorkoutOverviewSchema. This shields us from Gemini drifting
 * back into "include rest days as empty entries" mode despite the prompt.
 */
const PermissiveOverviewSchema = z.object({
  plan_name: z.string(),
  plan_rationale: z.string(),
  split_type: z.enum(['full_body', 'upper_lower', 'ppl', 'custom']),
  weeks_total: z.number().int(),
  days_per_week: z.number().int(),
  days: z.array(
    z.object({
      day_name: z.string(),
      muscle_groups: z.array(z.string()),
      estimated_duration_minutes: z.number(),
    }),
  ),
})

/**
 * Drop entries that look like rest days (empty muscle_groups, zero
 * duration, or names like "Rest"/"Off"/"Recovery") and clamp the
 * remaining entries to schema bounds. Returns a clean WorkoutOverview
 * the strict Zod schema will accept.
 */
function normaliseOverview(raw: unknown): WorkoutOverview {
  const parsed = PermissiveOverviewSchema.parse(raw)

  const isRestDay = (d: { day_name: string; muscle_groups: string[]; estimated_duration_minutes: number }): boolean => {
    if (d.muscle_groups.length === 0) return true
    if (d.estimated_duration_minutes <= 0) return true
    const name = d.day_name.toLowerCase().trim()
    return name === 'rest' || name === 'off' || name === 'recovery' || name.startsWith('rest day')
  }

  const trainingDays = parsed.days
    .filter((d) => !isRestDay(d))
    .map((d) => ({
      day_name: d.day_name,
      muscle_groups: d.muscle_groups,
      estimated_duration_minutes: Math.max(20, Math.min(120, Math.round(d.estimated_duration_minutes))),
    }))

  // Clamp to a maximum of 6 (the schema bound). If Gemini returned more
  // than days_per_week (e.g. produced 7 entries for a 4-day plan), trim
  // to the requested count.
  const expectedCount = Math.min(6, Math.max(1, parsed.days_per_week))
  const trimmed = trainingDays.slice(0, Math.max(expectedCount, 1))

  return WorkoutOverviewSchema.parse({
    plan_name: parsed.plan_name,
    plan_rationale: parsed.plan_rationale,
    split_type: parsed.split_type,
    weeks_total: parsed.weeks_total,
    days_per_week: parsed.days_per_week,
    days: trimmed,
  })
}

/**
 * Inputs that come from the plan generator modal form. The hook combines
 * these with the user's profile (age, sex, weight, goal, experience) to
 * build the full WorkoutPlanRequest.
 */
export interface GeneratePlanFormInput {
  split: 'full_body' | 'upper_lower' | 'ppl'
  daysPerWeek: 2 | 3 | 4 | 5 | 6
  durationWeeks: 4 | 6 | 8 | 12
  equipment: string[]
  focusMuscles?: string[]
}

export interface UseWorkoutPlanReturn {
  /**
   * Generate a plan with Gemini and save it to SQLite. Returns the new
   * planId so the caller can navigate to the plan view.
   */
  generate: (form: GeneratePlanFormInput) => Promise<number>
  isGenerating: boolean
  generateError: Error | null
  reset: () => void
}

export function useWorkoutPlan(): UseWorkoutPlanReturn {
  const sqlite = useSQLiteContext()
  // Memoise so the Drizzle handle is stable across renders — otherwise
  // every render creates a fresh wrapper and React Query sees new deps.
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profile = useProfileStore((s) => s.profile)

  const generateMutation = useMutation<number, Error, GeneratePlanFormInput>({
    mutationFn: async (form) => {
      if (!profile) {
        throw new Error('No profile loaded — cannot generate workout plan')
      }

      // 1. Build the WorkoutPlanRequest from profile + form
      const request: WorkoutPlanRequest = {
        age:             profile.age,
        sex:             profile.sex,
        weightKg:        profile.weightKg,
        goal:            profile.goal,
        experienceLevel: profile.experienceLevel,
        split:           form.split,
        daysPerWeek:     form.daysPerWeek,
        durationWeeks:   form.durationWeeks,
        equipment:       form.equipment,
        focusMuscles:    form.focusMuscles,
      }

      // ─── Phase 1: Overview ─────────────────────────────────
      // Single call returning plan metadata + day skeletons. We pass the
      // permissive schema to callAI() so the initial parse accepts whatever
      // shape Gemini returns (including rest-day entries with empty
      // muscle_groups), then normaliseOverview() filters out rest days and
      // clamps to schema bounds before final strict validation.
      const rawOverview = await callAI({
        system:         WORKOUT_OVERVIEW_SYSTEM_PROMPT,
        userMessage:    buildWorkoutOverviewPrompt(request),
        schema:         PermissiveOverviewSchema,
        responseSchema: WorkoutOverviewGeminiSchema,
        maxTokens:      2048,
      })
      const overview: WorkoutOverview = normaliseOverview(rawOverview)

      // ─── Phase 2: Day exercises (parallel) ─────────────────
      // One call per day, run in parallel. Each fits comfortably in
      // 4096 tokens because it's only 4-8 exercises with notes.
      // Free tier is 15 RPM — 6 parallel calls is well within budget.
      const dayExerciseResults: WorkoutDayExercises[] = await Promise.all(
        overview.days.map((day) =>
          callAI({
            system:         WORKOUT_DAY_EXERCISES_SYSTEM_PROMPT,
            userMessage:    buildWorkoutDayExercisesPrompt({
              experienceLevel:          profile.experienceLevel,
              goal:                     profile.goal,
              equipment:                form.equipment,
              dayName:                  day.day_name,
              muscleGroups:             day.muscle_groups,
              estimatedDurationMinutes: day.estimated_duration_minutes,
            }),
            schema:         WorkoutDayExercisesSchema,
            responseSchema: WorkoutDayExercisesGeminiSchema,
            maxTokens:      4096,
          }),
        ),
      )

      // ─── Stitch together the final WorkoutPlanResult ──────
      const result: WorkoutPlanResult = {
        plan_name:     overview.plan_name,
        plan_rationale: overview.plan_rationale,
        split_type:    overview.split_type,
        weeks_total:   overview.weeks_total,
        days_per_week: overview.days_per_week,
        days: overview.days.map((day, idx) => ({
          day_name:                   day.day_name,
          muscle_groups:              day.muscle_groups,
          estimated_duration_minutes: day.estimated_duration_minutes,
          exercises:                  dayExerciseResults[idx].exercises,
        })),
      }

      // 3. Map WorkoutPlanResult → SavePlanInput. Field names change from
      // snake_case (prompt/AI contract) to camelCase (DB query contract).
      const saveInput: SavePlanInput = {
        profileId:   profile.id,
        name:        result.plan_name,
        rationale:   result.plan_rationale,
        splitType:   result.split_type,
        weeksTotal:  result.weeks_total,
        daysPerWeek: result.days_per_week,
        days: result.days.map((day) => ({
          dayName:                  day.day_name,
          muscleGroups:             day.muscle_groups,
          estimatedDurationMinutes: day.estimated_duration_minutes,
          exercises: day.exercises.map((ex) => ({
            name:            ex.name,
            sets:            ex.sets,
            reps:            ex.reps,
            restSeconds:     ex.rest_seconds,
            weightKg:        ex.weight_kg,
            // Zod marks tempo as optional; DB query expects `string | null`.
            tempo:           ex.tempo ?? null,
            progressionNote: ex.progression_note,
          })),
        })),
      }

      // 4. Persist atomically inside a single db.transaction() and return
      // the new planId so the caller can navigate straight to the plan view.
      const planId = await saveGeneratedPlan(db, saveInput)
      return planId
    },
  })

  const reset = useCallback(() => {
    generateMutation.reset()
  }, [generateMutation])

  return {
    generate:       generateMutation.mutateAsync,
    isGenerating:   generateMutation.isPending,
    generateError:  generateMutation.error,
    reset,
  }
}
