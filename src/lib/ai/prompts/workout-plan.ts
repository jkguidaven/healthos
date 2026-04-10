// ═══════════════════════════════════════════════════════════════
// src/lib/ai/prompts/workout-plan.ts
// ─────────────────────────────────────────────────────────────
// Workout plan generation prompt. Given a user profile and plan
// generator form inputs, Gemini produces a periodised strength
// training programme tailored for body recomposition.
//
// Authoritative spec: ai-prompts.md § 2.
// Do not paraphrase the system prompt or relax the Zod bounds
// without updating the spec first.
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod'
import type { GeminiResponseSchema } from '../ai-client'

export const WORKOUT_PLAN_SYSTEM_PROMPT = `You are an experienced strength and conditioning coach specialising in natural body recomposition. You create periodised workout programmes grounded in sports science.

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
- Advanced: PPL or specialisation blocks, 5–6 sessions/week, RPE-based loading.

OUTPUT RULES:
- Exercise names must be standard, searchable names (e.g. "Barbell back squat" not "squats").
- sets and reps fields are integers. weight_kg is null (user fills in their working weight).
- rest_seconds is an integer number of seconds.
- Include a progression_note per exercise explaining exactly how to progress.
- The plan_rationale field (max 3 sentences) explains why this structure suits the user's goal.

The response schema is enforced. You MUST use these exact field names: plan_name, plan_rationale, split_type, weeks_total, days_per_week, days[].day_name, days[].muscle_groups[], days[].estimated_duration_minutes, days[].exercises[].name, days[].exercises[].sets, days[].exercises[].reps, days[].exercises[].rest_seconds, days[].exercises[].weight_kg, days[].exercises[].tempo, days[].exercises[].progression_note.`

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
  equipment: string[] // e.g. ['barbell', 'dumbbells', 'cable machine']
  focusMuscles?: string[] // optional emphasis muscles
}

export function buildWorkoutPlanPrompt(request: WorkoutPlanRequest): string {
  const focusLine =
    request.focusMuscles && request.focusMuscles.length > 0
      ? `\n- Muscle groups to emphasise: ${request.focusMuscles.join(', ')}`
      : ''

  return `Create a ${request.durationWeeks}-week ${request.split.replace('_', ' ')} workout plan.

User profile:
- Age: ${request.age}, sex: ${request.sex}, weight: ${request.weightKg}kg
- Goal: ${request.goal}
- Experience: ${request.experienceLevel}
- Training days per week: ${request.daysPerWeek}
- Available equipment: ${request.equipment.join(', ')}${focusLine}`
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

const WorkoutDaySchema = z.object({
  day_name: z.string().min(1).max(50),
  muscle_groups: z.array(z.string()).min(1).max(6),
  estimated_duration_minutes: z.number().int().min(20).max(120),
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

/**
 * Gemini-flavored response schema. Passing this in `generationConfig.responseSchema`
 * forces Gemini to produce exactly these field names (no guessing). The Zod schema
 * above is still used for runtime validation as a defensive second layer.
 */
export const WorkoutPlanGeminiSchema: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    plan_name: {
      type: 'STRING',
      description: 'Short, descriptive name for the plan',
    },
    plan_rationale: {
      type: 'STRING',
      description:
        "Max 3 sentences explaining why this structure suits the user's goal",
    },
    split_type: {
      type: 'STRING',
      enum: ['full_body', 'upper_lower', 'ppl', 'custom'],
      description: 'The training split used by the plan',
    },
    weeks_total: {
      type: 'INTEGER',
      description: 'Total duration of the plan in weeks',
    },
    days_per_week: {
      type: 'INTEGER',
      description: 'Number of training days per week',
    },
    days: {
      type: 'ARRAY',
      description: 'One entry per training day in the weekly cycle',
      items: {
        type: 'OBJECT',
        properties: {
          day_name: {
            type: 'STRING',
            description: 'Human-readable name for the session, e.g. "Push A"',
          },
          muscle_groups: {
            type: 'ARRAY',
            description: 'Primary muscle groups trained in this session',
            items: { type: 'STRING' },
          },
          estimated_duration_minutes: {
            type: 'INTEGER',
            description: 'Estimated total session duration in minutes',
          },
          exercises: {
            type: 'ARRAY',
            description:
              'Working sets only, ordered compound-first then isolation',
            items: {
              type: 'OBJECT',
              properties: {
                name: {
                  type: 'STRING',
                  description:
                    'Standard searchable exercise name, e.g. "Barbell back squat"',
                },
                sets: {
                  type: 'INTEGER',
                  description: 'Number of working sets',
                },
                reps: {
                  type: 'INTEGER',
                  description: 'Target reps per working set',
                },
                rest_seconds: {
                  type: 'INTEGER',
                  description:
                    'Rest between working sets in seconds (90–120s compound, 60s isolation)',
                },
                weight_kg: {
                  type: 'NUMBER',
                  description:
                    'Always null — user fills in their own working weight',
                  nullable: true,
                },
                tempo: {
                  type: 'STRING',
                  description:
                    'Optional tempo in eccentric-pause-concentric-pause notation, e.g. "2-0-1-0"',
                },
                progression_note: {
                  type: 'STRING',
                  description:
                    'How to progress this exercise over time (max 300 chars)',
                },
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
        required: [
          'day_name',
          'muscle_groups',
          'estimated_duration_minutes',
          'exercises',
        ],
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
