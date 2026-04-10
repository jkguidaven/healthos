# AI prompts specification

> **Agent context:** This document is the authoritative spec for every Gemini API call in HealthOS.
> Before touching anything in `src/lib/ai/prompts/` or `src/lib/ai/ai-client.ts`, read this file.
> The system prompts here are the exact strings used in production — do not paraphrase them.

---

## Overview

HealthOS makes three distinct AI calls:

| Feature | File | Model | Max output tokens | Avg latency |
|---|---|---|---|---|
| Food photo scan | `prompts/food-scan.ts` | gemini-2.5-flash | 1024 | ~3s |
| Workout plan generation | `prompts/workout-plan.ts` | gemini-2.5-flash | 4096 | ~8s |
| Daily coaching | `prompts/coach.ts` | gemini-2.5-flash | 2048 | ~4s |

All calls go through `callAI()` in `src/lib/ai/ai-client.ts`. That function:
1. Reads the API key from SecureStore via `getApiKey()`
2. Throws `APIKeyMissingError` if no key found
3. POSTs to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=<API_KEY>`
4. Sets `generationConfig: { responseMimeType: 'application/json', maxOutputTokens: <n> }` for structured JSON output
5. Validates the response (`candidates[0].content.parts[0].text`) with the provided Zod schema
6. Throws typed errors for `parse_error`, `api_error`, `rate_limit`, `key_invalid`

### Gemini request shape (reference)

```jsonc
// POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIza...
{
  "systemInstruction": {
    "parts": [{ "text": "<system prompt>" }]
  },
  "contents": [
    {
      "role": "user",
      "parts": [
        // text-only:
        { "text": "<user message>" }
        // OR vision:
        // { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } },
        // { "text": "<user message>" }
      ]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json",
    "maxOutputTokens": 1024
  }
}
```

### Gemini response shape (reference)

```jsonc
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [{ "text": "<JSON string matching the prompt's schema>" }]
      },
      "finishReason": "STOP"
    }
  ]
}
```

The JSON payload returned by the model lives at `candidates[0].content.parts[0].text` as a string — `JSON.parse` it, then validate against the Zod schema.

---

## 1. Food scan prompt

### Purpose
Given a base64-encoded food photo, identify the food and estimate its macronutrient content per serving.

### File
`src/lib/ai/prompts/food-scan.ts`

### System instruction

```
You are a nutrition analysis assistant. Your job is to identify food in photos and estimate macronutrient content.

RULES:
- Estimate for a single standard serving unless the image clearly shows multiple portions.
- If you see multiple distinct food items, identify the primary/largest item.
- Base estimates on standard nutritional databases (USDA). Round to nearest whole number.
- confidence: "high" = clearly identifiable food with well-known nutrition profile. "medium" = identifiable but portion is ambiguous or it's a mixed dish. "low" = unrecognisable, heavily processed, or obstructed.
- If you genuinely cannot identify the food at all, set name to "Unknown food" and confidence to "low" with all macros at 0.
- Never refuse to respond. Always return the JSON structure even for uncertain cases.
```

> Note: explicit "respond with JSON only, no markdown" instructions are no longer required because `responseMimeType: 'application/json'` enforces JSON output at the API level.

### User message construction

```typescript
// src/lib/ai/prompts/food-scan.ts

export interface FoodScanInput {
  imageBase64: string        // base64-encoded image, max 1024px longest side
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  mealContext?: string       // optional: 'breakfast' | 'lunch' | 'dinner' | 'snack'
}

export function buildFoodScanParts(input: FoodScanInput): GeminiPart[] {
  return [
    {
      inlineData: {
        mimeType: input.mimeType,
        data: input.imageBase64,
      },
    },
    {
      text: input.mealContext
        ? `Identify this food and estimate its macros. This is a ${input.mealContext} item.`
        : 'Identify this food and estimate its macros.',
    },
  ]
}
```

### Expected response shape

The Gemini response wraps the JSON payload in `candidates[0].content.parts[0].text`. After `JSON.parse`, the structure must match:

```json
{
  "name": "Chicken rice bowl",
  "calories": 620,
  "protein_g": 56,
  "carbs_g": 72,
  "fat_g": 12,
  "serving_description": "1 bowl (~400g)",
  "confidence": "medium",
  "notes": "Estimated 150g chicken breast, 150g cooked jasmine rice, sauce not accounted for"
}
```

### Zod schema

```typescript
// src/lib/ai/prompts/food-scan.ts

export const FoodScanResultSchema = z.object({
  name: z.string().min(1).max(100),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(500),
  fat_g: z.number().min(0).max(500),
  serving_description: z.string().max(100),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().max(300).optional(),
})

export type FoodScanResult = z.infer<typeof FoodScanResultSchema>
```

### Full callAI invocation

```typescript
// src/features/nutrition/use-food-scanner.ts

const result = await callAI({
  system: FOOD_SCAN_SYSTEM_PROMPT,        // imported from prompts/food-scan.ts
  userMessage: buildFoodScanParts(input),
  schema: FoodScanResultSchema,
  maxTokens: 1024,
})
```

### Image preprocessing (required before calling)

Before base64-encoding, resize the image so the longest side is ≤ 1024px. This keeps token usage low and improves scan speed. Use `expo-image-manipulator`:

```typescript
import * as ImageManipulator from 'expo-image-manipulator'

async function prepareImageForScan(uri: string): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],   // resize longest side to 1024px
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  )
  if (!result.base64) throw new Error('Image manipulation failed')
  return { base64: result.base64, mimeType: 'image/jpeg' }
}
```

### UI behaviour by confidence level

| Confidence | Card colour | Badge | User action required |
|---|---|---|---|
| `high` | `bg-teal-50` | green dot + "AI scan · high" | None — "Log this" is prominent |
| `medium` | `bg-amber-50` | amber dot + "AI scan · medium" | Nudge to review values |
| `low` | `bg-coral-50` | coral dot + "Low confidence" | Values are editable, message: "Consider verifying" |

---

## 2. Workout plan prompt

### Purpose
Generate a structured, periodised workout plan tailored to the user's goal, experience, equipment, and schedule. The plan is recomp-aware: it is not a generic bulk or cut programme.

### File
`src/lib/ai/prompts/workout-plan.ts`

### System instruction

```
You are an experienced strength and conditioning coach specialising in natural body recomposition. You create periodised workout programmes grounded in sports science.

PRINCIPLES YOU ALWAYS APPLY:
- Progressive overload is the primary driver of muscle gain. Every plan must have clear progression scheme (e.g. add 2.5kg when 3×8 is achieved cleanly).
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
- Include a progression_note per exercise explaining exactly how to progress.
- The plan_rationale field (max 3 sentences) explains why this structure suits the user's goal.
```

### Context shape

```typescript
// src/lib/ai/prompts/workout-plan.ts

export interface WorkoutPlanRequest {
  // From user profile
  age: number
  sex: 'male' | 'female'
  weightKg: number
  goal: 'recomposition' | 'bulk' | 'cut'      // always 'recomposition' for this app's primary flow
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'

  // From plan generator form
  split: 'full_body' | 'upper_lower' | 'ppl'
  daysPerWeek: 2 | 3 | 4 | 5 | 6
  durationWeeks: 4 | 6 | 8 | 12
  equipment: string[]       // e.g. ['barbell', 'dumbbells', 'cable machine', 'pull-up bar']
  focusMuscles?: string[]   // optional: user-selected muscle groups to emphasise
}

export function buildWorkoutPlanPrompt(request: WorkoutPlanRequest): string {
  return `Create a ${request.durationWeeks}-week ${request.split.replace('_', ' ')} workout plan.

User profile:
- Age: ${request.age}, sex: ${request.sex}, weight: ${request.weightKg}kg
- Goal: ${request.goal}
- Experience: ${request.experienceLevel}
- Training days per week: ${request.daysPerWeek}
- Available equipment: ${request.equipment.join(', ')}
${request.focusMuscles?.length ? `- Muscle groups to emphasise: ${request.focusMuscles.join(', ')}` : ''}`
}
```

### Expected response shape

```json
{
  "plan_name": "PPL Recomp — 8 weeks",
  "plan_rationale": "A Push/Pull/Legs split trains each muscle group twice weekly, optimal for recomposition at intermediate level. The 4-day frequency allows recovery while maintaining sufficient volume. Progressive overload is built into each exercise.",
  "split_type": "ppl",
  "weeks_total": 8,
  "days_per_week": 4,
  "days": [
    {
      "day_name": "Push A",
      "muscle_groups": ["chest", "shoulders", "triceps"],
      "estimated_duration_minutes": 60,
      "exercises": [
        {
          "name": "Barbell bench press",
          "sets": 4,
          "reps": 8,
          "rest_seconds": 120,
          "weight_kg": null,
          "tempo": "2-0-1-0",
          "progression_note": "Add 2.5kg when you complete all 4×8 with good form. If you fail a rep, stay at the same weight next session."
        },
        {
          "name": "Incline dumbbell press",
          "sets": 3,
          "reps": 10,
          "rest_seconds": 90,
          "weight_kg": null,
          "tempo": "2-0-1-0",
          "progression_note": "Move up one dumbbell size when all 3×10 feel easy (RPE 6 or below)."
        }
      ]
    }
  ]
}
```

### Zod schema

```typescript
// src/lib/ai/prompts/workout-plan.ts

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
```

### Full callAI invocation

```typescript
// src/features/workout/use-workout-plan.ts

const result = await callAI({
  system: WORKOUT_PLAN_SYSTEM_PROMPT,
  userMessage: buildWorkoutPlanPrompt(request),
  schema: WorkoutPlanResultSchema,
  maxTokens: 4096,
})
```

### Database write after successful generation

Plan generation writes to three tables in a single transaction:

```typescript
// src/lib/db/queries/workouts.ts

async function saveGeneratedPlan(plan: WorkoutPlanResult, profileId: number): Promise<number> {
  return db.transaction(async (tx) => {
    // 1. Insert plan header
    const [{ planId }] = await tx.insert(workoutPlanTable).values({
      name: plan.plan_name,
      splitType: plan.split_type,
      weeksTotal: plan.weeks_total,
      daysPerWeek: plan.days_per_week,
      rationale: plan.plan_rationale,
      profileId,
      createdAt: new Date().toISOString().split('T')[0],
    }).returning({ planId: workoutPlanTable.id })

    // 2. Insert each day + its exercises
    for (const day of plan.days) {
      const [{ dayId }] = await tx.insert(workoutDayTable).values({
        planId,
        dayName: day.day_name,
        muscleGroups: JSON.stringify(day.muscle_groups),
        estimatedMinutes: day.estimated_duration_minutes,
      }).returning({ dayId: workoutDayTable.id })

      for (let i = 0; i < day.exercises.length; i++) {
        const ex = day.exercises[i]
        await tx.insert(planExerciseTable).values({
          dayId,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.rest_seconds,
          weightKg: ex.weight_kg,
          tempo: ex.tempo ?? null,
          progressionNote: ex.progression_note,
          orderIndex: i,
        })
      }
    }

    return planId
  })
}
```

---

## 3. Daily coaching prompt

### Purpose
Synthesise the user's nutrition, workout, and body metrics data from the past 7 days into a personalised coaching message. The coach understands recomposition and never treats scale weight as the primary success metric.

### File
`src/lib/ai/prompts/coach.ts`

### System instruction

```
You are a body recomposition coach. You give personalised, evidence-based coaching based on a user's actual logged data.

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
```

### Context shape

```typescript
// src/lib/ai/prompts/coach.ts

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

  // Today's nutrition (from food_log, summed)
  todayNutrition: {
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
    waterMl: number
    mealsLogged: number          // 0 if no entries today
  } | null

  // Last 7 days nutrition averages
  weekNutritionAvg: {
    caloriesAvg: number
    proteinGAvg: number
    daysProteinHit: number       // days where protein >= goal
    daysLogged: number           // days with any food entries
  } | null

  // Last workout session
  lastWorkout: {
    sessionName: string          // e.g. "Push A"
    date: string                 // YYYY-MM-DD
    daysAgo: number
    exerciseCount: number
    anyPRs: boolean              // true if any set exceeded previous best
  } | null

  // Workouts this week
  weekWorkouts: {
    count: number
    targetCount: number          // from plan
  }

  // Body metrics — last 30 days
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
    loggingStreak: number        // consecutive days with food log entries
    workoutStreak: number        // consecutive weeks hitting workout target
  }

  // Day context
  todayIsTrainingDay: boolean
  currentWeekOfPlan: number | null
}

export function buildCoachPrompt(context: CoachContext): string {
  // Serialise context as structured text for clarity
  const lines: string[] = [
    `=== USER CONTEXT ===`,
    `Profile: ${context.profile.sex}, ${context.profile.age}yo, ${context.profile.weightKg}kg`,
    `Goals: ${context.profile.goalCalories}kcal / P${context.profile.goalProteinG}g C${context.profile.goalCarbsG}g F${context.profile.goalFatG}g`,
    `Experience: ${context.profile.experienceLevel}`,
    `Today is a ${context.todayIsTrainingDay ? 'training' : 'rest'} day`,
    context.currentWeekOfPlan ? `Currently in week ${context.currentWeekOfPlan} of their plan` : 'No active plan',
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
      `PRs in last session: ${lw.anyPRs ? 'yes' : 'no'}`,
    )
  } else {
    lines.push('No recent workout logged')
  }
  lines.push(`This week: ${context.weekWorkouts.count}/${context.weekWorkouts.targetCount} sessions completed`)

  lines.push(``, `=== BODY METRICS (30-day comparison) ===`)
  if (context.bodyMetrics) {
    const m = context.bodyMetrics
    if (m.weightKgLatest !== null && m.weightKg30dAgo !== null)
      lines.push(`Weight: ${m.weightKg30dAgo}kg → ${m.weightKgLatest}kg (${(m.weightKgLatest - m.weightKg30dAgo).toFixed(1)}kg change)`)
    if (m.waistCmLatest !== null && m.waistCm30dAgo !== null)
      lines.push(`Waist: ${m.waistCm30dAgo}cm → ${m.waistCmLatest}cm`)
    if (m.bodyFatPctLatest !== null && m.bodyFatPct30dAgo !== null)
      lines.push(`Body fat: ${m.bodyFatPct30dAgo}% → ${m.bodyFatPctLatest}%`)
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
```

### Expected response shape

```json
{
  "message": "Scale is up 0.3kg this week but your waist is down 0.5cm — that's the recomposition signal working exactly as it should.",
  "insights": [
    "Protein hit 5 out of 7 days this week — solid consistency for recomp",
    "Bench press added 2.5kg from last session — progressive overload on track",
    "Calories averaged slightly under goal on rest days — this is fine for recomp"
  ],
  "action_items": [
    "Add a protein shake today to hit your 172g target",
    "Next push session: attempt 82.5kg on bench if last set felt clean"
  ],
  "mood": "great",
  "weekly_highlight": "You hit a bench press PR this week — strength gain is the clearest sign lean mass is building."
}
```

### Zod schema

```typescript
// src/lib/ai/prompts/coach.ts

export const CoachResultSchema = z.object({
  message: z.string().min(10).max(400),
  insights: z.array(z.string().max(200)).min(1).max(5),
  action_items: z.array(z.string().max(200)).min(1).max(4),
  mood: z.enum(['great', 'good', 'check_in']),
  weekly_highlight: z.string().max(300),
})

export type CoachResult = z.infer<typeof CoachResultSchema>
```

### Full callAI invocation

```typescript
// src/features/coach/use-coach.ts

const result = await callAI({
  system: COACH_SYSTEM_PROMPT,
  userMessage: buildCoachPrompt(context),
  schema: CoachResultSchema,
  maxTokens: 2048,
})
```

### Caching strategy

Coach responses are cached in the `coach_entry` SQLite table. Do not call Gemini on every screen mount.

```typescript
// src/lib/db/queries/coach.ts

// Key: YYYY-MM-DD (today's date)
// On screen mount: check for today's entry first
async function getTodayCoachEntry(date: string): Promise<CoachResult | null> {
  const row = await db.select().from(coachEntryTable)
    .where(eq(coachEntryTable.date, date))
    .limit(1)
  if (row.length === 0) return null
  return JSON.parse(row[0].content) as CoachResult
}

// After successful Gemini call: save to cache
async function saveCoachEntry(date: string, result: CoachResult): Promise<void> {
  await db.insert(coachEntryTable).values({
    date,
    content: JSON.stringify(result),
    generatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: coachEntryTable.date,
    set: { content: JSON.stringify(result), generatedAt: new Date().toISOString() },
  })
}
```

### Context assembly query

Assembling `CoachContext` requires reading from five tables. This function should live in `src/lib/db/queries/coach.ts` and be called once before the Gemini call:

```typescript
async function buildCoachContext(db: DrizzleDB, profileId: number): Promise<CoachContext>
// Reads: profile, food_log (today + last 7 days), session (last + this week count),
//        body_metric (latest + 30d ago), and computes streaks from food_log date continuity
```

---

## Shared infrastructure

### `callAI` type signature

```typescript
// src/lib/ai/ai-client.ts

export interface GeminiInlineDataPart {
  inlineData: {
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
    data: string                  // base64-encoded
  }
}

export interface GeminiTextPart {
  text: string
}

export type GeminiPart = GeminiInlineDataPart | GeminiTextPart

interface CallAIParams<T> {
  system: string                  // becomes systemInstruction.parts[0].text
  userMessage: string | GeminiPart[]
  schema: z.ZodType<T>
  maxTokens: number               // becomes generationConfig.maxOutputTokens
}

async function callAI<T>(params: CallAIParams<T>): Promise<T>
```

Internally, `callAI` builds the request body as:

```typescript
const body = {
  systemInstruction: { parts: [{ text: params.system }] },
  contents: [
    {
      role: 'user',
      parts: typeof params.userMessage === 'string'
        ? [{ text: params.userMessage }]
        : params.userMessage,
    },
  ],
  generationConfig: {
    responseMimeType: 'application/json',
    maxOutputTokens: params.maxTokens,
  },
}
```

### Error types

```typescript
// src/lib/ai/types.ts

export class APIKeyMissingError extends Error {
  readonly code = 'key_missing' as const
}

export class APIKeyInvalidError extends Error {
  readonly code = 'key_invalid' as const
}

export class AIParseError extends Error {
  readonly code = 'parse_error' as const
  constructor(public readonly raw: string) {
    super('The AI returned a response that did not match the expected schema')
  }
}

export class AIApiError extends Error {
  readonly code = 'api_error' as const
  constructor(public readonly status: number) {
    super(`The AI provider returned HTTP ${status}`)
  }
}

export class AIRateLimitError extends Error {
  readonly code = 'rate_limit' as const
  constructor(public readonly retryAfterSeconds: number) {
    super(`Rate limited. Retry after ${retryAfterSeconds}s`)
  }
}

export type AIError =
  | APIKeyMissingError
  | APIKeyInvalidError
  | AIParseError
  | AIApiError
  | AIRateLimitError
```

### Response parsing pattern

Gemini's `responseMimeType: 'application/json'` enforces JSON output, but the app still defensively strips markdown fences before parsing in case the model ever wraps content:

```typescript
function parseGeminiJson<T>(response: unknown, schema: z.ZodType<T>): T {
  // Extract the text payload from candidates[0].content.parts[0].text
  const raw = (response as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  })?.candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof raw !== 'string') {
    throw new AIParseError(JSON.stringify(response))
  }

  // Defensive: strip markdown code fences if present
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new AIParseError(raw)
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new AIParseError(raw)
  }
  return result.data
}
```

---

## Prompt testing

Before committing changes to any prompt file, test it manually:

```bash
# From repo root — requires GEMINI_API_KEY in environment
pnpm prompt:test food-scan    # runs test in scripts/test-prompts/food-scan.ts
pnpm prompt:test workout-plan
pnpm prompt:test coach
```

Each test script sends a fixture input, validates the response against the Zod schema, and prints the result. Test fixtures live in `scripts/test-prompts/fixtures/`.

The `scripts/test-prompts/` directory is not part of the app bundle — it's dev tooling only.

---

*Last updated: April 2026.*
*This document is the source of truth for all Gemini API calls in HealthOS.*
*Changes to system prompts must be tested against the real API before committing.*
