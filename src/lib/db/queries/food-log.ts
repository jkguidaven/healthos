/**
 * src/lib/db/queries/food-log.ts
 *
 * Drizzle query helpers for the food_log table.
 * All functions take a DB handle as their first argument so they can be
 * unit-tested against an in-memory SQLite instance.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm'
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
 * Deduped list of foods the user has logged recently, sorted by how often
 * they appear (most frequent first) and then by recency. Used by the food
 * scan prompt as an identification anchor — if Gemini is unsure about a
 * photo, it can prefer a match from this list since users tend to eat the
 * same meals repeatedly.
 *
 * Only name + serving_description are returned: macros are deliberately
 * omitted so the model always recomputes them from the visible portion.
 *
 * Names are deduped case-insensitively but we return the most-recent
 * original casing for display-friendliness.
 */
export async function getRecentUniqueFoods(
  db: DB,
  profileId: number,
  days: number = 14,
  limit: number = 20,
): Promise<Array<{ name: string; servingDescription: string | null }>> {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - (days - 1))
  const fromIso = fromDate.toISOString().split('T')[0]
  const toIso = todayIso()

  const rows = await db
    .select({
      name: foodLogTable.name,
      servingDesc: foodLogTable.servingDesc,
      createdAt: foodLogTable.createdAt,
    })
    .from(foodLogTable)
    .where(
      and(
        eq(foodLogTable.profileId, profileId),
        gte(foodLogTable.date, fromIso),
        lte(foodLogTable.date, toIso),
      ),
    )
    .orderBy(desc(foodLogTable.createdAt))

  // Dedup case-insensitively, counting frequency, keeping the most recent
  // casing + serving description as the canonical entry.
  const bucket = new Map<
    string,
    { name: string; servingDescription: string | null; count: number; rank: number }
  >()

  rows.forEach((row, idx) => {
    const key = row.name.trim().toLowerCase()
    if (!key) return
    const existing = bucket.get(key)
    if (existing) {
      existing.count += 1
    } else {
      bucket.set(key, {
        name: row.name.trim(),
        servingDescription: row.servingDesc,
        count: 1,
        rank: idx, // recency rank (lower = more recent)
      })
    }
  })

  return Array.from(bucket.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.rank - b.rank
    })
    .slice(0, limit)
    .map(({ name, servingDescription }) => ({ name, servingDescription }))
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
