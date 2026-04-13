/**
 * src/lib/ai/tools/coach-tools.ts
 *
 * Function-calling tools exposed to the coach chat model. Each tool is
 * paired with a handler that runs a Drizzle query and returns a compact
 * JSON payload. The model decides when to call which tool based on the
 * user's question — the local "always-on" snapshot already covers the
 * common questions, so these tools are for drill-downs.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

import {
  bodyMetricTable,
  foodLogTable,
  sessionSetTable,
  sessionTable,
} from '@db/schema'
import type * as schema from '@db/schema'

import type { GeminiFunctionDeclaration } from '../ai-client'

type DB = ExpoSQLiteDatabase<typeof schema>

// ─────────────────────────────────────────────
// Tool declarations — sent to Gemini as functionDeclarations.
// Keep descriptions short + behavioural: the model reads these to
// decide when to call a tool.
// ─────────────────────────────────────────────

export const COACH_TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: 'getFoodLogsByDate',
    description:
      "Fetch every food entry the user logged on a specific date (YYYY-MM-DD). Use when the user asks about a specific day's meals or macros.",
    parameters: {
      type: 'OBJECT',
      properties: {
        date: {
          type: 'STRING',
          description: 'Date in YYYY-MM-DD format.',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'getDailyMacrosRange',
    description:
      'Fetch per-day calorie + macro totals over the last N days (1–30). Use for weekly/monthly nutrition questions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: { type: 'INTEGER', description: 'Number of days (1–30).' },
      },
      required: ['days'],
    },
  },
  {
    name: 'getWeightHistory',
    description:
      'Fetch the user\'s weight (kg) history over the last N days (1–365). Use for weight trend questions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: { type: 'INTEGER', description: 'Number of days (1–365).' },
      },
      required: ['days'],
    },
  },
  {
    name: 'getBodyMeasurements',
    description:
      'Fetch latest body measurements (waist, hip, chest, arm, thigh, body fat %). Use when the user asks about measurements or recomp signals.',
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
  {
    name: 'getRecentWorkouts',
    description:
      'Fetch completed workout sessions in the last N days (1–60) with exercise counts and PRs. Use for training history questions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: { type: 'INTEGER', description: 'Number of days (1–60).' },
      },
      required: ['days'],
    },
  },
  {
    name: 'getWorkoutSessionDetail',
    description:
      'Fetch all sets (exercise, reps, weight, RPE, PR flag) from a specific session id. Call after getRecentWorkouts when the user asks about a specific workout.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sessionId: { type: 'INTEGER', description: 'Session id.' },
      },
      required: ['sessionId'],
    },
  },
]

// ─────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────

export async function runCoachTool(
  db: DB,
  profileId: number,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'getFoodLogsByDate':
      return handleFoodLogsByDate(db, profileId, args)
    case 'getDailyMacrosRange':
      return handleDailyMacrosRange(db, profileId, args)
    case 'getWeightHistory':
      return handleWeightHistory(db, profileId, args)
    case 'getBodyMeasurements':
      return handleBodyMeasurements(db, profileId)
    case 'getRecentWorkouts':
      return handleRecentWorkouts(db, profileId, args)
    case 'getWorkoutSessionDetail':
      return handleWorkoutSessionDetail(db, args)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.round(v)))
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

async function handleFoodLogsByDate(
  db: DB,
  profileId: number,
  args: Record<string, unknown>,
): Promise<unknown> {
  const date = typeof args.date === 'string' ? args.date : todayIso()
  const rows = await db
    .select()
    .from(foodLogTable)
    .where(
      and(eq(foodLogTable.profileId, profileId), eq(foodLogTable.date, date)),
    )
  return {
    date,
    entries: rows.map((r) => ({
      meal: r.meal,
      name: r.name,
      calories: r.calories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      servingDesc: r.servingDesc,
    })),
  }
}

async function handleDailyMacrosRange(
  db: DB,
  profileId: number,
  args: Record<string, unknown>,
): Promise<unknown> {
  const days = clamp(args.days, 1, 30, 7)
  const fromIso = daysAgoIso(days - 1)
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
  const byDate = new Map<
    string,
    { calories: number; proteinG: number; carbsG: number; fatG: number; meals: number }
  >()
  for (const r of rows) {
    const t = byDate.get(r.date) ?? {
      calories: 0, proteinG: 0, carbsG: 0, fatG: 0, meals: 0,
    }
    t.calories += r.calories
    t.proteinG += r.proteinG
    t.carbsG += r.carbsG
    t.fatG += r.fatG
    t.meals += 1
    byDate.set(r.date, t)
  }
  const daily = Array.from(byDate.entries())
    .map(([date, t]) => ({
      date,
      calories: t.calories,
      proteinG: Math.round(t.proteinG * 10) / 10,
      carbsG: Math.round(t.carbsG * 10) / 10,
      fatG: Math.round(t.fatG * 10) / 10,
      mealsLogged: t.meals,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { fromDate: fromIso, toDate: toIso, daily }
}

async function handleWeightHistory(
  db: DB,
  profileId: number,
  args: Record<string, unknown>,
): Promise<unknown> {
  const days = clamp(args.days, 1, 365, 30)
  const fromIso = daysAgoIso(days - 1)
  const rows = await db
    .select({ date: bodyMetricTable.date, weightKg: bodyMetricTable.weightKg })
    .from(bodyMetricTable)
    .where(
      and(
        eq(bodyMetricTable.profileId, profileId),
        gte(bodyMetricTable.date, fromIso),
      ),
    )
    .orderBy(bodyMetricTable.date)
  return { days, entries: rows }
}

async function handleBodyMeasurements(
  db: DB,
  profileId: number,
): Promise<unknown> {
  const rows = await db
    .select()
    .from(bodyMetricTable)
    .where(eq(bodyMetricTable.profileId, profileId))
    .orderBy(desc(bodyMetricTable.date))
    .limit(1)
  const r = rows[0]
  if (!r) return { latest: null }
  return {
    latest: {
      date: r.date,
      weightKg: r.weightKg,
      waistCm: r.waistCm,
      hipCm: r.hipCm,
      chestCm: r.chestCm,
      armCm: r.armCm,
      thighCm: r.thighCm,
      bodyFatPct: r.bodyFatPct,
      leanMassKg: r.leanMassKg,
    },
  }
}

async function handleRecentWorkouts(
  db: DB,
  profileId: number,
  args: Record<string, unknown>,
): Promise<unknown> {
  const days = clamp(args.days, 1, 60, 14)
  const fromIso = daysAgoIso(days - 1)
  const sessions = await db
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.profileId, profileId),
        gte(sessionTable.date, fromIso),
      ),
    )
    .orderBy(desc(sessionTable.date))
  return {
    days,
    sessions: sessions.map((s) => ({
      sessionId: s.id,
      date: s.date,
      name: s.name,
      completed: s.completedAt !== null,
      durationMinutes: s.durationSeconds
        ? Math.round(s.durationSeconds / 60)
        : null,
    })),
  }
}

async function handleWorkoutSessionDetail(
  db: DB,
  args: Record<string, unknown>,
): Promise<unknown> {
  const sessionId = clamp(args.sessionId, 1, Number.MAX_SAFE_INTEGER, 0)
  if (sessionId === 0) return { error: 'Invalid sessionId' }
  const sets = await db
    .select()
    .from(sessionSetTable)
    .where(eq(sessionSetTable.sessionId, sessionId))
  return {
    sessionId,
    sets: sets.map((s) => ({
      exerciseName: s.exerciseName,
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      rpe: s.rpe,
      isPr: s.isPr,
    })),
  }
}
