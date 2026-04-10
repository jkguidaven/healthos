/**
 * src/lib/db/queries/water-log.ts
 *
 * Drizzle query helpers for the water_log table.
 * All functions take a DB handle as their first argument so they can be
 * unit-tested against an in-memory SQLite instance.
 *
 * Note: the schema stores one row per (profile, date) pair by convention —
 * addWater / setTodayWater read-then-write to maintain that invariant.
 */

import { and, eq } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import {
  waterLogTable,
  type WaterLogEntry,
  type NewWaterLogEntry,
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
 * Get today's water log row, or null if none exists.
 * The schema has one row per day (date is unique per profile by convention).
 */
export async function getTodayWaterLog(
  db: DB,
  profileId: number,
): Promise<WaterLogEntry | null> {
  const today = todayIso()
  const rows = await db
    .select()
    .from(waterLogTable)
    .where(
      and(
        eq(waterLogTable.profileId, profileId),
        eq(waterLogTable.date, today),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/**
 * Add water in mL to today's row. Creates the row if it doesn't exist.
 */
export async function addWater(
  db: DB,
  profileId: number,
  ml: number,
): Promise<WaterLogEntry> {
  const existing = await getTodayWaterLog(db, profileId)

  if (existing) {
    const rows = await db
      .update(waterLogTable)
      .set({ amountMl: existing.amountMl + ml })
      .where(eq(waterLogTable.id, existing.id))
      .returning()
    return rows[0]
  }

  const newRow: NewWaterLogEntry = {
    profileId,
    date: todayIso(),
    amountMl: ml,
  }
  const rows = await db.insert(waterLogTable).values(newRow).returning()
  return rows[0]
}

/**
 * Set today's water total to a specific mL amount (used by manual edit).
 */
export async function setTodayWater(
  db: DB,
  profileId: number,
  ml: number,
): Promise<WaterLogEntry> {
  const existing = await getTodayWaterLog(db, profileId)

  if (existing) {
    const rows = await db
      .update(waterLogTable)
      .set({ amountMl: ml })
      .where(eq(waterLogTable.id, existing.id))
      .returning()
    return rows[0]
  }

  const newRow: NewWaterLogEntry = {
    profileId,
    date: todayIso(),
    amountMl: ml,
  }
  const rows = await db.insert(waterLogTable).values(newRow).returning()
  return rows[0]
}
