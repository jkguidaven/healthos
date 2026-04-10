/**
 * src/lib/db/queries/workouts.ts
 *
 * Drizzle query helpers for the workout-related tables:
 *   workout_plan, workout_day, plan_exercise, session, session_set
 *
 * All functions take a DB handle as their first argument so they can be
 * unit-tested against an in-memory SQLite instance.
 */

import { and, asc, desc, eq, gte, isNotNull, isNull } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import {
  planExerciseTable,
  sessionSetTable,
  sessionTable,
  workoutDayTable,
  workoutPlanTable,
  type NewSessionSet,
  type PlanExercise,
  type Session,
  type SessionSet,
  type WorkoutDay,
  type WorkoutPlan,
} from '../schema'
import type * as schema from '../schema'

type DB = ExpoSQLiteDatabase<typeof schema>

/**
 * Return today's date as YYYY-MM-DD (local-ish, no timezone).
 */
function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Return the current moment as an ISO datetime string — matches the
 * `datetime('now')` format SQLite uses for the default completedAt values.
 */
function nowIso(): string {
  return new Date().toISOString()
}

// ─────────────────────────────────────────────
// PLAN MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Get the most recent (active) workout plan for a profile.
 * Prefers rows flagged `is_active = true`, falling back to the newest row
 * if none are flagged. Returns null if the user has never generated a plan.
 */
export async function getActivePlan(
  db: DB,
  profileId: number,
): Promise<WorkoutPlan | null> {
  const activeRows = await db
    .select()
    .from(workoutPlanTable)
    .where(
      and(
        eq(workoutPlanTable.profileId, profileId),
        eq(workoutPlanTable.isActive, true),
      ),
    )
    .orderBy(desc(workoutPlanTable.createdAt))
    .limit(1)

  if (activeRows[0]) return activeRows[0]

  const anyRows = await db
    .select()
    .from(workoutPlanTable)
    .where(eq(workoutPlanTable.profileId, profileId))
    .orderBy(desc(workoutPlanTable.createdAt))
    .limit(1)

  return anyRows[0] ?? null
}

/**
 * Get all days for a plan, ordered by their natural sequence (orderIndex).
 * Each day's exercises are NOT included — call getPlanDayExercises separately
 * to keep the queries flat and predictable.
 */
export async function getPlanDays(
  db: DB,
  planId: number,
): Promise<WorkoutDay[]> {
  return db
    .select()
    .from(workoutDayTable)
    .where(eq(workoutDayTable.planId, planId))
    .orderBy(asc(workoutDayTable.orderIndex))
}

/**
 * Get all exercises for a specific day, in their orderIndex order.
 */
export async function getPlanDayExercises(
  db: DB,
  dayId: number,
): Promise<PlanExercise[]> {
  return db
    .select()
    .from(planExerciseTable)
    .where(eq(planExerciseTable.dayId, dayId))
    .orderBy(asc(planExerciseTable.orderIndex))
}

/**
 * Structured input for saving an AI-generated workout plan.
 *
 * Mirrors the shape of the Zod result type used by the plan-generation
 * prompt, but is declared as a plain TS type so this file stays free of
 * any AI / Zod imports.
 */
export interface SavePlanInput {
  profileId: number
  name: string
  rationale: string
  splitType: 'full_body' | 'upper_lower' | 'ppl' | 'custom'
  weeksTotal: number
  daysPerWeek: number
  days: readonly {
    dayName: string
    muscleGroups: string[]
    estimatedDurationMinutes: number
    exercises: readonly {
      name: string
      sets: number
      reps: number
      restSeconds: number
      weightKg: number | null
      tempo: string | null
      progressionNote: string
    }[]
  }[]
}

/**
 * Save an AI-generated plan (header + days + exercises) atomically.
 * Returns the new plan id. Used by the workout plan generation hook
 * once the AI provider returns a parsed result.
 *
 * The whole write runs inside a transaction — if any day/exercise insert
 * fails the entire plan is rolled back.
 */
export async function saveGeneratedPlan(
  db: DB,
  input: SavePlanInput,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [{ planId }] = await tx
      .insert(workoutPlanTable)
      .values({
        profileId: input.profileId,
        name: input.name,
        rationale: input.rationale,
        splitType: input.splitType,
        weeksTotal: input.weeksTotal,
        daysPerWeek: input.daysPerWeek,
        isActive: true,
        startDate: todayIso(),
      })
      .returning({ planId: workoutPlanTable.id })

    for (let dayIdx = 0; dayIdx < input.days.length; dayIdx++) {
      const day = input.days[dayIdx]
      const [{ dayId }] = await tx
        .insert(workoutDayTable)
        .values({
          planId,
          dayName: day.dayName,
          muscleGroups: JSON.stringify(day.muscleGroups),
          estimatedMinutes: day.estimatedDurationMinutes,
          orderIndex: dayIdx,
        })
        .returning({ dayId: workoutDayTable.id })

      for (let exIdx = 0; exIdx < day.exercises.length; exIdx++) {
        const ex = day.exercises[exIdx]
        await tx.insert(planExerciseTable).values({
          dayId,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds,
          weightKg: ex.weightKg,
          tempo: ex.tempo,
          progressionNote: ex.progressionNote,
          orderIndex: exIdx,
        })
      }
    }

    return planId
  })
}

// ─────────────────────────────────────────────
// SESSION MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Start a new session for a given plan day. Returns the new session row.
 * Sets startedAt to now, completedAt null.
 *
 * The session's `name` is copied from the plan day (e.g. "Push A"). If the
 * day can't be found (e.g. stale dayId), the name falls back to "Workout".
 */
export async function startSession(
  db: DB,
  planId: number,
  dayId: number,
): Promise<Session> {
  const dayRows = await db
    .select()
    .from(workoutDayTable)
    .where(eq(workoutDayTable.id, dayId))
    .limit(1)
  const day = dayRows[0]

  const planRows = await db
    .select()
    .from(workoutPlanTable)
    .where(eq(workoutPlanTable.id, planId))
    .limit(1)
  const plan = planRows[0]
  if (!plan) {
    throw new Error(`startSession: plan ${planId} not found`)
  }

  const rows = await db
    .insert(sessionTable)
    .values({
      profileId: plan.profileId,
      planId,
      dayId,
      date: todayIso(),
      name: day?.dayName ?? 'Workout',
      startedAt: nowIso(),
      completedAt: null,
    })
    .returning()

  return rows[0]
}

/**
 * Get the active (uncompleted) session for a profile, if any.
 * Used to restore the session-in-progress when the user reopens the app
 * mid-workout.
 */
export async function getActiveSession(
  db: DB,
  profileId: number,
): Promise<Session | null> {
  const rows = await db
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.profileId, profileId),
        isNull(sessionTable.completedAt),
      ),
    )
    .orderBy(desc(sessionTable.startedAt))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Mark a session as completed. Sets completedAt to now.
 */
export async function completeSession(
  db: DB,
  sessionId: number,
): Promise<void> {
  await db
    .update(sessionTable)
    .set({ completedAt: nowIso() })
    .where(eq(sessionTable.id, sessionId))
}

/**
 * Get all completed sessions in the last N days for a profile, newest first.
 * Used by the dashboard "workouts this week" mini-stat and similar widgets.
 */
export async function getRecentSessions(
  db: DB,
  profileId: number,
  daysAgo: number,
): Promise<Session[]> {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - daysAgo)
  const fromIso = fromDate.toISOString().split('T')[0]

  return db
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.profileId, profileId),
        gte(sessionTable.date, fromIso),
        isNotNull(sessionTable.completedAt),
      ),
    )
    .orderBy(desc(sessionTable.date))
}

/**
 * Count of sessions completed this calendar week (Mon 00:00 → Sun 23:59)
 * for a profile. Used by the dashboard.
 */
export async function getWeekSessionCount(
  db: DB,
  profileId: number,
): Promise<number> {
  const now = new Date()
  // JS: 0 = Sunday, 1 = Monday ... convert so Monday is start-of-week.
  const dayOfWeek = now.getDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)
  const mondayIso = monday.toISOString().split('T')[0]

  const rows = await db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.profileId, profileId),
        gte(sessionTable.date, mondayIso),
        isNotNull(sessionTable.completedAt),
      ),
    )

  return rows.length
}

// ─────────────────────────────────────────────
// SET LOGGING
// ─────────────────────────────────────────────

/**
 * Input for logging a completed set within a session.
 * `setIndex` is 0-based: which set within the exercise this is (0 = first set).
 * It maps to the schema's 1-based `setNumber` column (setIndex + 1).
 */
export interface LogSetInput {
  sessionId: number
  exerciseId: number // refers to planExerciseTable.id
  setIndex: number // 0-based: which set within the exercise
  weightKg: number | null
  reps: number
  isPR?: boolean
}

/**
 * Log a completed set within a session. Returns the new row.
 * `isPR` can be left for the caller to compute — defaults to false.
 *
 * Copies the exercise name into the denormalised `exerciseName` column so
 * set history can be rendered without a join to `plan_exercise`.
 */
export async function logSet(
  db: DB,
  input: LogSetInput,
): Promise<SessionSet> {
  const exerciseRows = await db
    .select()
    .from(planExerciseTable)
    .where(eq(planExerciseTable.id, input.exerciseId))
    .limit(1)
  const exercise = exerciseRows[0]
  if (!exercise) {
    throw new Error(`logSet: plan exercise ${input.exerciseId} not found`)
  }

  const values: NewSessionSet = {
    sessionId: input.sessionId,
    planExerciseId: input.exerciseId,
    exerciseName: exercise.name,
    setNumber: input.setIndex + 1,
    weightKg: input.weightKg,
    reps: input.reps,
    isPr: input.isPR ?? false,
  }

  const rows = await db.insert(sessionSetTable).values(values).returning()
  return rows[0]
}

/**
 * Get all logged sets for a session, ordered by loggedAt (oldest first).
 * Callers can group by `planExerciseId` / `exerciseName` in JS if needed.
 */
export async function getSessionSets(
  db: DB,
  sessionId: number,
): Promise<SessionSet[]> {
  return db
    .select()
    .from(sessionSetTable)
    .where(eq(sessionSetTable.sessionId, sessionId))
    .orderBy(asc(sessionSetTable.loggedAt))
}

/**
 * Get the last completed session for a specific plan day. Used by
 * progressive-overload tracking — compare current session against the
 * previous time the user did the same workout.
 *
 * `excludeSessionId` lets the active session itself be skipped when the
 * caller is mid-session (otherwise it would always return its own row).
 */
export async function getLastSessionForDay(
  db: DB,
  profileId: number,
  dayId: number,
  excludeSessionId?: number,
): Promise<Session | null> {
  const rows = await db
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.profileId, profileId),
        eq(sessionTable.dayId, dayId),
        isNotNull(sessionTable.completedAt),
      ),
    )
    .orderBy(desc(sessionTable.date), desc(sessionTable.startedAt))
    .limit(5)

  for (const row of rows) {
    if (excludeSessionId !== undefined && row.id === excludeSessionId) continue
    return row
  }
  return null
}

/**
 * Get every set logged in the previous session for a given plan day,
 * grouped by exercise name. The set arrays are ordered oldest-first so
 * `[0]` is the user's first working set, `[last]` is the heaviest top
 * set in most progressions.
 *
 * Used by the active session logger for "Last week: 80kg × 8" hints
 * and "+2.5kg from last week" overload badges. Returns an empty map
 * when there is no previous session.
 */
export async function getLastSessionSetsByExercise(
  db: DB,
  profileId: number,
  dayId: number,
  excludeSessionId?: number,
): Promise<Map<string, SessionSet[]>> {
  const previous = await getLastSessionForDay(
    db,
    profileId,
    dayId,
    excludeSessionId,
  )
  if (!previous) return new Map()

  const sets = await getSessionSets(db, previous.id)
  const grouped = new Map<string, SessionSet[]>()
  for (const set of sets) {
    const list = grouped.get(set.exerciseName)
    if (list) {
      list.push(set)
    } else {
      grouped.set(set.exerciseName, [set])
    }
  }
  return grouped
}
