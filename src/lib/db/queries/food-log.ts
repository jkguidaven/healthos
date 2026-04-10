/**
 * src/lib/db/queries/food-log.ts
 *
 * Drizzle query helpers for the food_log table.
 * All functions take a DB handle as their first argument so they can be
 * unit-tested against an in-memory SQLite instance.
 */

import { and, eq, gte, lte } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import {
  foodLogTable,
  type FoodLogEntry,
  type NewFoodLogEntry,
} from '../schema'
import type * as schema from '../schema'

type DB = ExpoSQLiteDatabase<typeof schema>

/**
 * Return today's date as YYYY-MM-DD (local date, no timezone).
 */
function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get all food log entries for a profile on a given date.
 * Ordered by createdAt (oldest first), so meal sections show in chronological order.
 */
export async function getFoodLogByDate(
  db: DB,
  profileId: number,
  date: string, // YYYY-MM-DD
): Promise<FoodLogEntry[]> {
  return db
    .select()
    .from(foodLogTable)
    .where(
      and(
        eq(foodLogTable.profileId, profileId),
        eq(foodLogTable.date, date),
      ),
    )
    .orderBy(foodLogTable.createdAt) // oldest first
}

/**
 * Get all food log entries for today.
 */
export async function getTodayFoodLog(
  db: DB,
  profileId: number,
): Promise<FoodLogEntry[]> {
  return getFoodLogByDate(db, profileId, todayIso())
}

/**
 * Get a single food log entry by id. Returns null if it doesn't exist.
 * Used by the edit form to pre-populate fields.
 */
export async function getFoodLogEntry(
  db: DB,
  id: number,
): Promise<FoodLogEntry | null> {
  const rows = await db
    .select()
    .from(foodLogTable)
    .where(eq(foodLogTable.id, id))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Insert a new food log entry. Returns the saved row with its id.
 */
export async function insertFoodLogEntry(
  db: DB,
  entry: NewFoodLogEntry,
): Promise<FoodLogEntry> {
  const rows = await db.insert(foodLogTable).values(entry).returning()
  return rows[0]
}

/**
 * Update an existing food log entry by id. Returns the updated row.
 */
export async function updateFoodLogEntry(
  db: DB,
  id: number,
  updates: Partial<NewFoodLogEntry>,
): Promise<FoodLogEntry> {
  const rows = await db
    .update(foodLogTable)
    .set(updates)
    .where(eq(foodLogTable.id, id))
    .returning()
  return rows[0]
}

/**
 * Delete a food log entry by id.
 */
export async function deleteFoodLogEntry(db: DB, id: number): Promise<void> {
  await db.delete(foodLogTable).where(eq(foodLogTable.id, id))
}

/**
 * Sum the macros for today's food log entries. Returns zeros if nothing logged.
 * Used by the dashboard for the calories + protein hero card.
 */
export async function getTodayMacroSummary(
  db: DB,
  profileId: number,
): Promise<{
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  mealsLogged: number
}> {
  const rows = await getTodayFoodLog(db, profileId)

  return rows.reduce(
    (acc, row) => ({
      calories: acc.calories + row.calories,
      proteinG: acc.proteinG + row.proteinG,
      carbsG: acc.carbsG + row.carbsG,
      fatG: acc.fatG + row.fatG,
      mealsLogged: acc.mealsLogged + 1,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, mealsLogged: 0 },
  )
}

/**
 * Compute 7-day averages for nutrition. Used by the AI coach context.
 * Returns zeroed fields if there's no data in the window.
 *
 * Averages are computed across *days that had any entries*, so a user
 * who only logged 3 of the last 7 days gets the mean of those 3 days.
 */
export async function getWeekNutritionAvg(
  db: DB,
  profileId: number,
): Promise<{
  caloriesAvg: number
  proteinGAvg: number
  daysLogged: number
}> {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 6) // last 7 days inclusive of today
  const fromIso = fromDate.toISOString().split('T')[0]
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

  if (rows.length === 0) {
    return { caloriesAvg: 0, proteinGAvg: 0, daysLogged: 0 }
  }

  // Group by date -> total calories / protein per day
  const dailyTotals = new Map<
    string,
    { calories: number; proteinG: number }
  >()

  for (const row of rows) {
    const existing = dailyTotals.get(row.date) ?? { calories: 0, proteinG: 0 }
    existing.calories += row.calories
    existing.proteinG += row.proteinG
    dailyTotals.set(row.date, existing)
  }

  const daysLogged = dailyTotals.size
  let caloriesSum = 0
  let proteinSum = 0
  for (const total of dailyTotals.values()) {
    caloriesSum += total.calories
    proteinSum += total.proteinG
  }

  return {
    caloriesAvg: Math.round(caloriesSum / daysLogged),
    proteinGAvg: Math.round((proteinSum / daysLogged) * 10) / 10,
    daysLogged,
  }
}
