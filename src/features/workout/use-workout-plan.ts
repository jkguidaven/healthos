// ═══════════════════════════════════════════════════════════════
// src/features/workout/use-workout-plan.ts
// ─────────────────────────────────────────────────────────────
// Layer 3 (feature hook) for the workout plan generator.
//
// Orchestrates a single React Query mutation that:
//   1. Reads the active profile from the Zustand store.
//   2. Combines profile + form inputs into a WorkoutPlanRequest.
//   3. Calls Gemini with structured-output enforcement via
//      WorkoutPlanGeminiSchema (prevents field-name drift — same
//      bug we fixed for food-scan).
//   4. Maps the validated WorkoutPlanResult into the
//      SavePlanInput shape and persists it atomically through
//      saveGeneratedPlan (header + days + exercises in one tx).
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

import { callAI } from '@ai/ai-client'
import {
  WORKOUT_PLAN_SYSTEM_PROMPT,
  WorkoutPlanGeminiSchema,
  WorkoutPlanResultSchema,
  buildWorkoutPlanPrompt,
  type WorkoutPlanRequest,
  type WorkoutPlanResult,
} from '@ai/prompts/workout-plan'
import { saveGeneratedPlan, type SavePlanInput } from '@db/queries/workouts'
import * as schema from '@db/schema'
import { useProfileStore } from '@/stores/profile-store'

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

      // 2. Call Gemini with structured output enforcement. Passing
      // responseSchema constrains Gemini to exactly the field names we
      // expect — without it the response shape can drift and Zod rejects.
      const result: WorkoutPlanResult = await callAI({
        system:         WORKOUT_PLAN_SYSTEM_PROMPT,
        userMessage:    buildWorkoutPlanPrompt(request),
        schema:         WorkoutPlanResultSchema,
        responseSchema: WorkoutPlanGeminiSchema,
        // Workout plans are much bigger than food scans — don't cut off.
        maxTokens:      4096,
      })

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
