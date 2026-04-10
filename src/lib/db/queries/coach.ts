/**
 * src/lib/db/queries/coach.ts
 *
 * Drizzle query helpers for the AI coach feature.
 *
 *   - `buildCoachContext(db, profileId)` reads from five tables and
 *     returns the `CoachContext` object the prompt builder consumes.
 *   - `getTodayCoachEntry` / `saveCoachEntry` are the cache layer that
 *     stops the screen from re-calling Gemini on every mount.
 *
 * The context assembler is intentionally NOT a thin wrapper around the
 * existing single-purpose helpers in `food-log.ts` / `workouts.ts` /
 * `metrics.ts`. The coach prompt needs aggregated, derived fields that
 * those helpers don't expose (`daysProteinHit`, `loggingStreak`,
 * `currentWeekOfPlan`, …) and assembling them by stitching together a
 * dozen small queries would be slower and harder to reason about.
 * Instead, this file does its own focused range queries and walks the
 * results in JS once.
 *
 * Hard rules: no `any`, no raw SQL, no React/Zustand imports.
 */

import { and, desc, eq, gte, isNotNull, lte } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

import {
  coachEntryTable,
  foodLogTable,
  profileTable,
  sessionSetTable,
  sessionTable,
  workoutDayTable,
  type Profile,
} from '../schema'
import type * as schema from '../schema'

import {
  getBodyMetricNDaysAgo,
  getLatestBodyMetric,
} from './metrics'
import { getActivePlan } from './workouts'
import { getTodayWaterLog } from './water-log'
import {
  CoachResultSchema,
  type CoachContext,
  type CoachResult,
} from '@/lib/ai/prompts/coach'

type DB = ExpoSQLiteDatabase<typeof schema>

// ─────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD in the device's local-ish UTC date. */
function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

/** N days before today as YYYY-MM-DD. */
function daysAgoIso(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

/** Number of whole days between two YYYY-MM-DD dates. */
function dayDiff(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.round((to - from) / (24 * 60 * 60 * 1000))
}

/** Stable Mon-as-start-of-week ISO date for a given Date. */
function isoWeekKey(date: Date): string {
  const dayOfWeek = date.getDay() // 0 = Sun, 1 = Mon
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────
// Profile → CoachContext.profile
// ─────────────────────────────────────────────────────────────

function toContextProfile(profile: Profile): CoachContext['profile'] {
  return {
    sex: profile.sex,
    age: profile.age,
    weightKg: profile.weightKg,
    goalCalories: profile.goalCalories,
    goalProteinG: profile.goalProteinG,
    goalCarbsG: profile.goalCarbsG,
    goalFatG: profile.goalFatG,
    experienceLevel: profile.experienceLevel,
  }
}

// ─────────────────────────────────────────────────────────────
// Today + 7-day nutrition aggregation
//
// We pull the full 7-day window once and compute everything from it
// (today's totals, week averages, days-protein-hit, logging streak)
// in a single pass — much cheaper than calling four separate helpers.
// ─────────────────────────────────────────────────────────────

interface NutritionWindow {
  today: CoachContext['todayNutrition']
  weekAvg: CoachContext['weekNutritionAvg']
  loggingStreak: number
}

async function buildNutritionWindow(
  db: DB,
  profileId: number,
  goalProteinG: number,
): Promise<NutritionWindow> {
  const fromIso = daysAgoIso(6) // last 7 days inclusive of today
  const toIso = todayIso()

  const rows = await db
    .select()
    .from(foodLogTable)
    .where(
      and(
        eq(foodLogTable.profileId, profileId),
        gte(foodLogTable.date, fromIso),
        lte(foodLogTable.date, toIso),
      ),
    )

  // Group by date so we can compute daily totals once.
  const dailyTotals = new Map<
    string,
    { calories: number; proteinG: number; carbsG: number; fatG: number; meals: number }
  >()
  for (const row of rows) {
    const existing = dailyTotals.get(row.date) ?? {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      meals: 0,
    }
    existing.calories += row.calories
    existing.proteinG += row.proteinG
    existing.carbsG += row.carbsG
    existing.fatG += row.fatG
    existing.meals += 1
    dailyTotals.set(row.date, existing)
  }

  // Today's nutrition needs water from the water_log table — pull it
  // separately rather than threading another arg through this helper.
  const todayWaterRow = await getTodayWaterLog(db, profileId)
  const todayWaterMl = todayWaterRow?.amountMl ?? 0
  const todayTotals = dailyTotals.get(toIso) ?? null

  const today: CoachContext['todayNutrition'] =
    todayTotals && todayTotals.meals > 0
      ? {
          calories: todayTotals.calories,
          proteinG: round1(todayTotals.proteinG),
          carbsG: round1(todayTotals.carbsG),
          fatG: round1(todayTotals.fatG),
          waterMl: todayWaterMl,
          mealsLogged: todayTotals.meals,
        }
      : null

  let weekAvg: CoachContext['weekNutritionAvg'] = null
  if (dailyTotals.size > 0) {
    let calSum = 0
    let proSum = 0
    let daysProteinHit = 0
    for (const total of dailyTotals.values()) {
      calSum += total.calories
      proSum += total.proteinG
      if (goalProteinG > 0 && total.proteinG >= goalProteinG) daysProteinHit += 1
    }
    weekAvg = {
      caloriesAvg: Math.round(calSum / dailyTotals.size),
      proteinGAvg: round1(proSum / dailyTotals.size),
      daysProteinHit,
      daysLogged: dailyTotals.size,
    }
  }

  return {
    today,
    weekAvg,
    loggingStreak: computeLoggingStreak(dailyTotals, toIso),
  }
}

/**
 * Walk backwards from today and count consecutive days with at least
 * one food log entry. Stops at the first gap. The 7-day window means
 * the streak caps at 7 — that's good enough for the prompt; real long
 * streaks aren't load-bearing for the message tone.
 */
function computeLoggingStreak(
  dailyTotals: Map<string, unknown>,
  todayIsoStr: string,
): number {
  let streak = 0
  for (let i = 0; i < 7; i += 1) {
    const dateIso = daysAgoIso(i)
    if (!dailyTotals.has(dateIso)) {
      // Today might legitimately be empty before any meals are logged.
      // Allow ONE empty leading day (today) before breaking, so a user
      // who's logged for 5 days in a row but hasn't eaten breakfast yet
      // still sees a 5-day streak.
      if (i === 0 && dateIso === todayIsoStr) continue
      break
    }
    streak += 1
  }
  return streak
}

// ─────────────────────────────────────────────────────────────
// Workouts → lastWorkout, weekWorkouts, todayIsTrainingDay,
// currentWeekOfPlan, workoutStreak
// ─────────────────────────────────────────────────────────────

interface WorkoutSlice {
  lastWorkout: CoachContext['lastWorkout']
  weekWorkouts: CoachContext['weekWorkouts']
  todayIsTrainingDay: boolean
  currentWeekOfPlan: number | null
  workoutStreak: number
}

async function buildWorkoutSlice(
  db: DB,
  profileId: number,
): Promise<WorkoutSlice> {
  const plan = await getActivePlan(db, profileId)
  const targetCount = plan?.daysPerWeek ?? 0

  // Pull the last 84 days of completed sessions in one query — used
  // for "last workout", "this week count", and "workout streak".
  const fromIso = daysAgoIso(84)
  const recentSessions = await db
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

  // Last workout — newest by date, then enrich with set data.
  let lastWorkout: CoachContext['lastWorkout'] = null
  const last = recentSessions[0]
  if (last) {
    const sets = await db
      .select()
      .from(sessionSetTable)
      .where(eq(sessionSetTable.sessionId, last.id))
    const distinctExercises = new Set<string>()
    let anyPRs = false
    for (const s of sets) {
      distinctExercises.add(s.exerciseName)
      if (s.isPr) anyPRs = true
    }
    lastWorkout = {
      sessionName: last.name,
      date: last.date,
      daysAgo: Math.max(0, dayDiff(last.date, todayIso())),
      exerciseCount: distinctExercises.size,
      anyPRs,
    }
  }

  // This week (Mon → today) count.
  const thisWeekKey = isoWeekKey(new Date())
  const weekCount = recentSessions.filter(
    (s) => isoWeekKey(new Date(`${s.date}T00:00:00Z`)) === thisWeekKey,
  ).length

  // Workout streak — consecutive ISO weeks (most recent first) where
  // sessions completed >= plan.daysPerWeek. Stops at the first miss.
  let workoutStreak = 0
  if (targetCount > 0) {
    const byWeek = new Map<string, number>()
    for (const s of recentSessions) {
      const key = isoWeekKey(new Date(`${s.date}T00:00:00Z`))
      byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
    }
    let cursor = new Date()
    for (let i = 0; i < 12; i += 1) {
      const key = isoWeekKey(cursor)
      const count = byWeek.get(key) ?? 0
      if (count >= targetCount) {
        workoutStreak += 1
      } else {
        // Allow the current (in-progress) week to fall short without
        // breaking the streak — only break if a *past* week missed.
        if (i === 0) {
          // current week
        } else {
          break
        }
      }
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() - 7)
    }
  }

  // Today is a training day if any plan_day for the active plan has
  // a name matching today's day-of-week pattern. Plans don't store
  // day-of-week directly, so we approximate by checking whether the
  // user has already logged a session today (definitive yes) OR
  // whether today's index in the rotation falls inside daysPerWeek.
  let todayIsTrainingDay = false
  const todayIsoStr = todayIso()
  if (recentSessions.some((s) => s.date === todayIsoStr)) {
    todayIsTrainingDay = true
  } else if (plan) {
    // Fallback: count plan days for the active plan and assume the
    // user has a fixed weekly rotation. If they have N training days
    // out of 7, treat today as a training day if the position in the
    // rotation lines up. This is intentionally loose — the prompt
    // tolerates "training day" being a hint, not a hard fact.
    const planDayCount = await db
      .select({ id: workoutDayTable.id })
      .from(workoutDayTable)
      .where(eq(workoutDayTable.planId, plan.id))
    todayIsTrainingDay = planDayCount.length >= 5 // 5+ days/week → almost always
  }

  // currentWeekOfPlan — diff between today and plan.startDate, in
  // whole weeks (1-indexed), clamped to [1, weeksTotal]. Null if no plan.
  let currentWeekOfPlan: number | null = null
  if (plan?.startDate) {
    const days = Math.max(0, dayDiff(plan.startDate, todayIsoStr))
    const week = Math.floor(days / 7) + 1
    currentWeekOfPlan = Math.min(Math.max(week, 1), plan.weeksTotal)
  }

  return {
    lastWorkout,
    weekWorkouts: { count: weekCount, targetCount },
    todayIsTrainingDay,
    currentWeekOfPlan,
    workoutStreak,
  }
}

// ─────────────────────────────────────────────────────────────
// Body metrics → bodyMetrics
// ─────────────────────────────────────────────────────────────

async function buildBodyMetricsSlice(
  db: DB,
  profileId: number,
): Promise<CoachContext['bodyMetrics']> {
  const [latest, monthAgo] = await Promise.all([
    getLatestBodyMetric(db, profileId),
    getBodyMetricNDaysAgo(db, profileId, 30),
  ])

  if (!latest && !monthAgo) return null

  return {
    weightKgLatest: latest?.weightKg ?? null,
    weightKg30dAgo: monthAgo?.weightKg ?? null,
    waistCmLatest: latest?.waistCm ?? null,
    waistCm30dAgo: monthAgo?.waistCm ?? null,
    bodyFatPctLatest: latest?.bodyFatPct ?? null,
    bodyFatPct30dAgo: monthAgo?.bodyFatPct ?? null,
  }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Assemble the full CoachContext from SQLite. Throws if no profile
 * exists for the given id — the caller is expected to gate this on
 * onboarding completion.
 */
export async function buildCoachContext(
  db: DB,
  profileId: number,
): Promise<CoachContext> {
  const profileRows = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.id, profileId))
    .limit(1)
  const profile = profileRows[0]
  if (!profile) {
    throw new Error(`buildCoachContext: profile ${profileId} not found`)
  }

  const [nutrition, workouts, bodyMetrics] = await Promise.all([
    buildNutritionWindow(db, profileId, profile.goalProteinG),
    buildWorkoutSlice(db, profileId),
    buildBodyMetricsSlice(db, profileId),
  ])

  return {
    profile: toContextProfile(profile),
    todayNutrition: nutrition.today,
    weekNutritionAvg: nutrition.weekAvg,
    lastWorkout: workouts.lastWorkout,
    weekWorkouts: workouts.weekWorkouts,
    bodyMetrics,
    streaks: {
      loggingStreak: nutrition.loggingStreak,
      workoutStreak: workouts.workoutStreak,
    },
    todayIsTrainingDay: workouts.todayIsTrainingDay,
    currentWeekOfPlan: workouts.currentWeekOfPlan,
  }
}

/**
 * Get the cached coach entry for a given date, or null if none exists
 * yet. The screen calls this on mount before deciding whether to invoke
 * Gemini — coach responses cost tokens and shouldn't regenerate per visit.
 */
export async function getTodayCoachEntry(
  db: DB,
  date: string, // YYYY-MM-DD
): Promise<CoachResult | null> {
  const rows = await db
    .select()
    .from(coachEntryTable)
    .where(eq(coachEntryTable.date, date))
    .limit(1)
  const row = rows[0]
  if (!row) return null

  // Defensive: a manually-edited cache row could have invalid JSON.
  // Treat parse failures as a cache miss so the screen regenerates.
  try {
    const parsed = JSON.parse(row.content) as unknown
    return CoachResultSchema.parse(parsed)
  } catch {
    return null
  }
}

/**
 * Upsert a coach entry. The `date` column is unique, so re-running for
 * the same day overwrites the previous response (used by the "regenerate"
 * button on the coach screen).
 */
export async function saveCoachEntry(
  db: DB,
  profileId: number,
  date: string, // YYYY-MM-DD
  result: CoachResult,
): Promise<void> {
  const content = JSON.stringify(result)
  const generatedAt = new Date().toISOString()

  await db
    .insert(coachEntryTable)
    .values({
      profileId,
      date,
      entryType: 'daily',
      content,
      mood: result.mood,
      generatedAt,
    })
    .onConflictDoUpdate({
      target: coachEntryTable.date,
      set: { content, mood: result.mood, generatedAt },
    })
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
